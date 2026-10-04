package duties

import (
	"math"
	"testing"
)

func TestComputeDESWPower(t *testing.T) {
	tests := []struct {
		gini float64
		want float64
	}{
		{gini: 0.0, want: 0.6},
		{gini: 0.2, want: 0.6},
		{gini: 0.5, want: 0.5},
		{gini: 0.9, want: 0.1},
		{gini: 1.0, want: 0.1},
	}

	for _, test := range tests {
		if got := computeDESWPower(test.gini); math.Abs(got-test.want) > 1e-12 {
			t.Fatalf("computeDESWPower(%v) = %v, want %v", test.gini, got, test.want)
		}
	}
}

func TestDESWPowerInvariants(t *testing.T) {
	previous := computeDESWPower(0.0)
	for step := 0; step <= 100; step++ {
		power := computeDESWPower(float64(step) / 100.0)
		if power < 0.1 || power > 0.6 {
			t.Fatalf("power %v is outside [0.1, 0.6]", power)
		}
		if power > previous {
			t.Fatalf("power increased from %v to %v", previous, power)
		}
		previous = power
	}

	for _, power := range []float64{0.1, 0.5, 0.6} {
		if math.Pow(64, power) <= math.Pow(32, power) {
			t.Fatalf("larger stake did not have larger weight at power %v", power)
		}
	}
}
