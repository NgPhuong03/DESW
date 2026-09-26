package duties

import (
	"crypto/sha256"
	"encoding/binary"
	"errors"
	"fmt"
	"math"
	"math/big"

	"github.com/attestantio/go-eth2-client/spec/phase0"
	"github.com/ethpandaops/dora/clients/consensus"
)

const seedSize = int8(32)
const roundSize = int8(1)
const positionWindowSize = int8(4)
const pivotViewSize = seedSize + roundSize
const totalSize = seedSize + roundSize + positionWindowSize

var maxShuffleListSize uint64 = 1 << 40

type ActiveIndiceIndex uint32

type BeaconState struct {
	RandaoMix           *phase0.Hash32
	NextRandaoMix       *phase0.Hash32
	GetRandaoMixes      func() []phase0.Root
	GetActiveCount      func() uint64
	GetEffectiveBalance func(index ActiveIndiceIndex) phase0.Gwei
}

func Hash(data []byte) phase0.Hash32 {
	return sha256.Sum256(data)
}

func UintToBytes(data any) []byte {
	var res []byte

	if d64, ok := data.(uint64); ok {
		res = make([]byte, 8)
		binary.LittleEndian.PutUint64(res, d64)
	} else if d32, ok := data.(uint32); ok {
		res = make([]byte, 4)
		binary.LittleEndian.PutUint32(res, d32)
	} else if d16, ok := data.(uint16); ok {
		res = make([]byte, 2)
		binary.LittleEndian.PutUint16(res, d16)
	} else if d8, ok := data.(uint8); ok {
		res = []byte{d8}
	}

	return res
}

func BytesToUint(data []byte) uint64 {
	switch len(data) {
	case 1:
		return uint64(data[0])
	case 2:
		return uint64(binary.LittleEndian.Uint16(data))
	case 4:
		return uint64(binary.LittleEndian.Uint32(data))
	case 8:
		return binary.LittleEndian.Uint64(data)
	default:
		return 0
	}
}

func SplitOffset(listSize, chunks, index uint64) uint64 {
	return (listSize * index) / chunks
}

func GetRandaoMix(spec *consensus.ChainSpec, state *BeaconState, epoch phase0.Epoch) phase0.Hash32 {
	randaoMixes := state.GetRandaoMixes()
	index := int(epoch % phase0.Epoch(spec.EpochsPerHistoricalVector))
	return phase0.Hash32(randaoMixes[index])
}

func GetSeed(spec *consensus.ChainSpec, state *BeaconState, epoch phase0.Epoch, domainType phase0.DomainType) phase0.Hash32 {
	var mix phase0.Hash32
	if state.RandaoMix == nil {
		mix = GetRandaoMix(spec, state, epoch+phase0.Epoch(spec.EpochsPerHistoricalVector-spec.MinSeedLookahead-1))
		state.RandaoMix = &mix

		nextMix := GetRandaoMix(spec, state, epoch+phase0.Epoch(spec.EpochsPerHistoricalVector-spec.MinSeedLookahead-1)+1)
		state.NextRandaoMix = &nextMix
	} else {
		mix = *state.RandaoMix
	}

	data := []byte{}
	data = append(data, domainType[:]...)
	data = append(data, UintToBytes(uint64(epoch))...)
	data = append(data, mix[:]...)

	return Hash(data)
}

func ComputeShuffledIndex(spec *consensus.ChainSpec, index uint64, indexCount uint64, seed [32]byte, shuffle bool) (uint64, error) {
	if spec.ShuffleRoundCount == 0 {
		return index, nil
	}
	if uint64(index) >= indexCount {
		return 0, fmt.Errorf("input index %d out of bounds: %d",
			index, indexCount)
	}
	if indexCount > maxShuffleListSize {
		return 0, fmt.Errorf("list size %d out of bounds",
			indexCount)
	}
	rounds := uint8(spec.ShuffleRoundCount)
	round := uint8(0)
	if !shuffle {
		// Starting last round and iterating through the rounds in reverse, un-swaps everything,
		// effectively un-shuffling the list.
		round = rounds - 1
	}
	buf := make([]byte, totalSize)
	posBuffer := make([]byte, 8)

	// Seed is always the first 32 bytes of the hash input, we never have to change this part of the buffer.
	copy(buf[:32], seed[:])
	for {
		buf[seedSize] = round
		h := Hash(buf[:pivotViewSize])
		hash8 := h[:8]
		hash8Int := BytesToUint(hash8)
		pivot := hash8Int % indexCount
		flip := (pivot + indexCount - uint64(index)) % indexCount
		// Consider every pair only once by picking the highest pair index to retrieve randomness.
		position := uint64(index)
		if flip > position {
			position = flip
		}
		// Add position except its last byte to []buf for randomness,
		// it will be used later to select a bit from the resulting hash.
		binary.LittleEndian.PutUint64(posBuffer[:8], position>>8)
		copy(buf[pivotViewSize:], posBuffer[:4])
		source := Hash(buf)
		// Effectively keep the first 5 bits of the byte value of the position,
		// and use it to retrieve one of the 32 (= 2^5) bytes of the hash.
		byteV := source[(position&0xff)>>3]
		// Using the last 3 bits of the position-byte, determine which bit to get from the hash-byte (note: 8 bits = 2^3)
		bitV := (byteV >> (position & 0x7)) & 0x1
		// index = flip if bit else index
		if bitV == 1 {
			index = flip
		}
		if shuffle {
			round++
			if round == rounds {
				break
			}
		} else {
			if round == 0 {
				break
			}
			round--
		}
	}
	return index, nil
}

func GetProposerIndex(spec *consensus.ChainSpec, state *BeaconState, slot phase0.Slot) (ActiveIndiceIndex, error) {
	epoch := phase0.Epoch(slot / phase0.Slot(spec.SlotsPerEpoch))

	seedData := []byte{}
	seedHash := GetSeed(spec, state, epoch, spec.DomainBeaconProposer)
	seedData = append(seedData, seedHash[:]...)
	seedData = append(seedData, UintToBytes(uint64(slot))...)

	seed := Hash(seedData)

	activeIndicesCount := state.GetActiveCount()
	if activeIndicesCount == 0 {
		return 0, fmt.Errorf("empty active indices list")
	}

	// Create active indices list for Gini calculation
	activeIndices := make([]ActiveIndiceIndex, activeIndicesCount)
	for i := uint64(0); i < activeIndicesCount; i++ {
		activeIndices[i] = ActiveIndiceIndex(i)
	}

	// Pre-compute Gini coefficient once for all iterations
	gini, err := computeGiniCoefficient(state, activeIndices)
	if err != nil {
		return 0, fmt.Errorf("failed to compute Gini coefficient: %w", err)
	}

	if spec.ElectraForkEpoch != nil && epoch >= phase0.Epoch(*spec.ElectraForkEpoch) {
		// Electra fork with stake power calculation
		maxRandomValue := uint64(1<<16 - 1)
		maxEffectiveBalance := spec.MaxEffectiveBalanceElectra

		for i := uint64(0); ; i++ {
			candidateIndex, err := ComputeShuffledIndex(spec, i%activeIndicesCount, activeIndicesCount, seed, true)
			if err != nil {
				return 0, err
			}

			randomValue, err := shufflingRandomValue(i, seed)
			if err != nil {
				return 0, err
			}

			effectiveBal := uint64(state.GetEffectiveBalance(ActiveIndiceIndex(candidateIndex)))

			// Calculate stake power for the candidate
			stakePower, err := computeStakePower(effectiveBal, activeIndices, gini, state)
			if err != nil {
				return 0, fmt.Errorf("failed to compute stake power: %w", err)
			}

			// Calculate stake power for max effective balance
			maxStakePower, err := computeStakePower(maxEffectiveBalance, activeIndices, gini, state)
			if err != nil {
				return 0, fmt.Errorf("failed to compute max stake power: %w", err)
			}

			// Use stake power comparison instead of direct effective balance comparison
			if stakePower*float64(maxRandomValue) >= maxStakePower*float64(randomValue) {
				return ActiveIndiceIndex(candidateIndex), nil
			}
		}

	} else {
		// pre-Electra fork with stake power calculation
		maxRandomByte := uint64(1<<8 - 1)
		maxEffectiveBalance := spec.MaxEffectiveBalance

		for i := uint64(0); ; i++ {
			candidateIndex, err := ComputeShuffledIndex(spec, i%activeIndicesCount, activeIndicesCount, seed, true)
			if err != nil {
				return 0, err
			}

			randomByte := shufflingRandomByte(i, seed)
			effectiveBal := uint64(state.GetEffectiveBalance(ActiveIndiceIndex(candidateIndex)))

			// Calculate stake power for the candidate
			stakePower, err := computeStakePower(effectiveBal, activeIndices, gini, state)
			if err != nil {
				return 0, fmt.Errorf("failed to compute stake power: %w", err)
			}

			// Calculate stake power for max effective balance
			maxStakePower, err := computeStakePower(maxEffectiveBalance, activeIndices, gini, state)
			if err != nil {
				return 0, fmt.Errorf("failed to compute max stake power: %w", err)
			}

			// Use stake power comparison instead of direct effective balance comparison
			// Apply epsilon tolerance to ignore tiny differences in floating-point comparison
			const epsilon = 1e-12

			lhs := stakePower * float64(maxRandomByte)
			rhs := maxStakePower * float64(randomByte)
			threshold := rhs - epsilon*math.Max(math.Abs(rhs), 1.0)

			if lhs >= threshold {
				return ActiveIndiceIndex(candidateIndex), nil
			}
		}
	}
}

func GetAttesterDuties(spec *consensus.ChainSpec, state *BeaconState, epoch phase0.Epoch) ([][][]ActiveIndiceIndex, error) {
	seed := GetSeed(spec, state, epoch, spec.DomainBeaconAttester)

	validatorCount := state.GetActiveCount()
	committeesPerSlot := SlotCommitteeCount(spec, validatorCount)
	committeesCount := committeesPerSlot * spec.SlotsPerEpoch

	// Save the shuffled indices in cache, this is only needed once per epoch or once per new committee index.
	shuffledIndices := make([]ActiveIndiceIndex, validatorCount)
	for i := uint64(0); i < validatorCount; i++ {
		shuffledIndices[i] = ActiveIndiceIndex(i)
	}

	// UnshuffleList is used here as it is an optimized implementation created
	// for fast computation of committees.
	// Reference implementation: https://github.com/protolambda/eth2-shuffle
	_, err := UnshuffleList(spec, shuffledIndices, seed)
	if err != nil {
		return nil, err
	}

	attesterDuties := make([][][]ActiveIndiceIndex, spec.SlotsPerEpoch)
	for slotIndex := uint64(0); slotIndex < spec.SlotsPerEpoch; slotIndex++ {
		committees := [][]ActiveIndiceIndex{}

		for committeeIndex := uint64(0); committeeIndex < committeesPerSlot; committeeIndex++ {
			indexOffset := committeeIndex + (slotIndex * committeesPerSlot)

			start := SplitOffset(validatorCount, committeesCount, indexOffset)
			end := SplitOffset(validatorCount, committeesCount, indexOffset+1)

			if start > validatorCount || end > validatorCount {
				return nil, errors.New("index out of range")
			}

			committees = append(committees, shuffledIndices[start:end])
		}

		attesterDuties[slotIndex] = committees
	}

	return attesterDuties, nil
}

func SlotCommitteeCount(spec *consensus.ChainSpec, activeValidatorCount uint64) uint64 {
	var committeesPerSlot = activeValidatorCount / spec.SlotsPerEpoch / spec.TargetCommitteeSize

	if committeesPerSlot > spec.MaxCommitteesPerSlot {
		return spec.MaxCommitteesPerSlot
	}
	if committeesPerSlot == 0 {
		return 1
	}

	return committeesPerSlot
}

func ShuffleList(spec *consensus.ChainSpec, input []ActiveIndiceIndex, seed [32]byte) ([]ActiveIndiceIndex, error) {
	return innerShuffleList(spec, input, seed, true /* shuffle */)
}

// UnshuffleList un-shuffles the list by running backwards through the round count.
func UnshuffleList(spec *consensus.ChainSpec, input []ActiveIndiceIndex, seed [32]byte) ([]ActiveIndiceIndex, error) {
	return innerShuffleList(spec, input, seed, false /* un-shuffle */)
}

// shuffles or unshuffles, shuffle=false to un-shuffle.
func innerShuffleList(spec *consensus.ChainSpec, input []ActiveIndiceIndex, seed [32]byte, shuffle bool) ([]ActiveIndiceIndex, error) {
	if len(input) <= 1 {
		return input, nil
	}
	if uint64(len(input)) > maxShuffleListSize {
		return nil, fmt.Errorf("list size %d out of bounds",
			len(input))
	}
	rounds := uint8(spec.ShuffleRoundCount)
	if rounds == 0 {
		return input, nil
	}
	listSize := uint64(len(input))
	buf := make([]byte, totalSize)
	r := uint8(0)
	if !shuffle {
		r = rounds - 1
	}
	copy(buf[:seedSize], seed[:])
	for {
		buf[seedSize] = r
		ph := Hash(buf[:pivotViewSize])
		pivot := binary.LittleEndian.Uint64(ph[:8]) % listSize
		mirror := (pivot + 1) >> 1
		binary.LittleEndian.PutUint32(buf[pivotViewSize:], uint32(pivot>>8))
		source := Hash(buf)
		byteV := source[(pivot&0xff)>>3]
		for i, j := uint64(0), pivot; i < mirror; i, j = i+1, j-1 {
			byteV, source = swapOrNot(buf, byteV, ActiveIndiceIndex(i), input, ActiveIndiceIndex(j), source)
		}
		// Now repeat, but for the part after the pivot.
		mirror = (pivot + listSize + 1) >> 1
		end := listSize - 1
		binary.LittleEndian.PutUint32(buf[pivotViewSize:], uint32(end>>8))
		source = Hash(buf)
		byteV = source[(end&0xff)>>3]
		for i, j := pivot+1, end; i < mirror; i, j = i+1, j-1 {
			byteV, source = swapOrNot(buf, byteV, ActiveIndiceIndex(i), input, ActiveIndiceIndex(j), source)
		}
		if shuffle {
			r++
			if r == rounds {
				break
			}
		} else {
			if r == 0 {
				break
			}
			r--
		}
	}
	return input, nil
}

// swapOrNot describes the main algorithm behind the shuffle where we swap bytes in the inputted value
// depending on if the conditions are met.
func swapOrNot(buf []byte, byteV byte, i ActiveIndiceIndex, input []ActiveIndiceIndex, j ActiveIndiceIndex, source [32]byte) (byte, [32]byte) {
	if j&0xff == 0xff {
		// just overwrite the last part of the buffer, reuse the start (seed, round)
		binary.LittleEndian.PutUint32(buf[pivotViewSize:], uint32(j>>8))
		source = Hash(buf)
	}
	if j&0x7 == 0x7 {
		byteV = source[(j&0xff)>>3]
	}
	bitV := (byteV >> (j & 0x7)) & 0x1

	if bitV == 1 {
		input[i], input[j] = input[j], input[i]
	}
	return byteV, source
}

// computeGiniCoefficient calculates the Gini coefficient for the given validator indices based on their effective balances.
// The Gini coefficient measures inequality in the distribution of effective balances.
// Returns a value between 0 (perfect equality) and 1 (maximum inequality).
func computeGiniCoefficient(state *BeaconState, indices []ActiveIndiceIndex) (float64, error) {
	if len(indices) == 0 {
		return 0.0, nil
	}

	// Collect effective balances for the given indices
	balances := make([]uint64, len(indices))
	for i, idx := range indices {
		balances[i] = uint64(state.GetEffectiveBalance(idx))
	}

	// Use the direct formula for better accuracy with equal values
	return computeGiniCoefficientDirect(balances), nil
}

// trapz computes the area under a curve using the trapezoidal rule.
func trapz(y []float64, dx float64) float64 {
	if len(y) < 2 {
		return 0.0
	}

	var area float64
	for i := 0; i < len(y)-1; i++ {
		area += 0.5 * (y[i] + y[i+1]) * dx
	}
	return area
}

// computeGiniCoefficientDirect calculates Gini coefficient using the direct formula
// This is more accurate for equal values
func computeGiniCoefficientDirect(balances []uint64) float64 {
	if len(balances) <= 1 {
		return 0.0
	}

	n := float64(len(balances))

	// Calculate mean
	var sum uint64
	for _, balance := range balances {
		sum += balance
	}
	mean := float64(sum) / n

	// Calculate Gini coefficient using the direct formula
	var giniSum float64
	for i := 0; i < len(balances); i++ {
		for j := 0; j < len(balances); j++ {
			giniSum += math.Abs(float64(balances[i]) - float64(balances[j]))
		}
	}

	return giniSum / (2 * n * n * mean)
}

// computeStakePower calculates the stake power for a validator based on their effective balance and the Gini coefficient.
// This implements the stake power calculation from the Electra fork specification.
func computeStakePower(effectiveBalance uint64, indices []ActiveIndiceIndex, gini float64, state *BeaconState) (float64, error) {
	power := computeDESWPower(gini)

	// Calculate effective balance raised to the power
	eb := math.Pow(float64(effectiveBalance), power)

	// Collect all effective balances for normalization
	balances := make([]uint64, len(indices))
	for i, idx := range indices {
		balances[i] = uint64(state.GetEffectiveBalance(idx))
	}

	// Use big.Int to avoid overflow when summing large effective balances
	totalWeight := big.NewInt(0)
	for _, balance := range balances {
		totalWeight.Add(totalWeight, big.NewInt(int64(balance)))
	}
	if totalWeight.Cmp(big.NewInt(0)) == 0 {
		return 0.0, nil
	}

	// Convert to float64 for power calculation
	totalWeightF64, _ := new(big.Float).SetInt(totalWeight).Float64()

	// Normalize by total weight raised to the power
	eb = eb / math.Pow(totalWeightF64, power)
	return eb, nil
}

func computeDESWPower(gini float64) float64 {
	return math.Max(0.1, math.Min(0.6, 1.0-gini))
}

// shufflingRandomValue calculates the random value for shuffling based on the iteration index and seed.
func shufflingRandomValue(i uint64, seed [32]byte) (uint64, error) {
	// For Electra fork, use 16-bit random values
	b := append(seed[:], UintToBytes(i/16)...)
	offset := (i % 16) * 2
	hash := Hash(b)
	return BytesToUint(hash[offset : offset+2]), nil
}

// shufflingRandomByte calculates the random byte for shuffling (pre-Electra).
func shufflingRandomByte(i uint64, seed [32]byte) byte {
	b := append(seed[:], UintToBytes(i/32)...)
	return Hash(b)[i%32]
}
