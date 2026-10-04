package duties

import (
	"encoding/hex"
	"encoding/json"
	"os"
	"testing"

	"github.com/attestantio/go-eth2-client/spec/phase0"
	"github.com/ethpandaops/dora/clients/consensus"
)

func TestWeightedProposerReferenceVectors(t *testing.T) {
	payload, err := os.ReadFile("proposer_vectors.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Slot     uint64   `json:"slot"`
		Electra  bool     `json:"electra"`
		Balances []uint64 `json:"balances"`
		Randao   string   `json:"randao"`
		Expected uint32   `json:"expected"`
	}
	if err := json.Unmarshal(payload, &cases); err != nil {
		t.Fatal(err)
	}
	for _, c := range cases {
		raw, err := hex.DecodeString(c.Randao)
		if err != nil {
			t.Fatal(err)
		}
		var mix phase0.Hash32
		copy(mix[:], raw)
		var electraEpoch *uint64
		if c.Electra {
			zero := uint64(0)
			electraEpoch = &zero
		}
		spec := &consensus.ChainSpec{
			SlotsPerEpoch: 32, ShuffleRoundCount: 90,
			DomainBeaconProposer: phase0.DomainType{0, 0, 0, 0},
			MaxEffectiveBalance:  32000000000, MaxEffectiveBalanceElectra: 2048000000000,
			ElectraForkEpoch: electraEpoch,
		}
		state := &BeaconState{
			RandaoMix:           &mix,
			GetActiveCount:      func() uint64 { return uint64(len(c.Balances)) },
			GetEffectiveBalance: func(index ActiveIndiceIndex) phase0.Gwei { return phase0.Gwei(c.Balances[index]) },
		}
		got, err := GetProposerIndex(spec, state, phase0.Slot(c.Slot))
		if err != nil {
			t.Fatalf("slot=%d electra=%v: %v", c.Slot, c.Electra, err)
		}
		if uint32(got) != c.Expected {
			t.Fatalf("slot=%d electra=%v: got %d want %d", c.Slot, c.Electra, got, c.Expected)
		}
	}
}
