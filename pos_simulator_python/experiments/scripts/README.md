# Scripts So Sánh Consensus

## 1. compare_weighted_desw_sybil.py

Script so sánh WEIGHTED vs DESW PoS với phân tích Sybil Attack.

### Mục đích

So sánh 2 loại consensus (WEIGHTED và DESW) trong các kịch bản:

1. **Không có Sybil Attack**: Chạy bình thường
2. **Có Sybil Attack**: Một entity thực hiện sybil attack (chia stake thành nhiều validators)

Mục tiêu chính: **Xác định xem khi một validator thực hiện sybil attack, tổng số lần nó (và các validators con) được chọn làm proposer có tăng hay giảm so với khi không sybil.**

### Cách chạy

```bash
cd pos_simulator_python/experiments/scripts
python compare_weighted_desw_sybil.py
```

### Output

Script sẽ tạo các files trong folder `results/sybil_comparison/`:

1. **CSV Files cho mỗi scenario**:

   - `WEIGHTED_NO_SYBIL_<timestamp>.csv`: Dữ liệu chi tiết WEIGHTED không sybil
   - `WEIGHTED_WITH_SYBIL_<timestamp>.csv`: Dữ liệu chi tiết WEIGHTED có sybil
   - `DESW_NO_SYBIL_<timestamp>.csv`: Dữ liệu chi tiết DESW không sybil
   - `DESW_WITH_SYBIL_<timestamp>.csv`: Dữ liệu chi tiết DESW có sybil

2. **Summary JSON Files**:
   - `WEIGHTED_SUMMARY_<timestamp>.json`: Tóm tắt kết quả WEIGHTED
   - `DESW_SUMMARY_<timestamp>.json`: Tóm tắt kết quả DESW

### Format CSV Output

Mỗi file CSV chứa các cột:

| Cột                | Mô tả                                                           |
| ------------------ | --------------------------------------------------------------- |
| `epoch`            | Epoch hiện tại                                                  |
| `validator_index`  | Index của validator trong mảng stakes                           |
| `entity_id`        | Entity ID (nhiều validators có thể cùng entity_id nếu bị sybil) |
| `stake`            | Số lượng stake hiện tại                                         |
| `stake_percentage` | Phần trăm stake so với tổng                                     |
| `is_selected`      | Validator có được chọn làm proposer không (True/False)          |
| `reward_received`  | Phần thưởng nhận được (hoặc penalty nếu âm)                     |
| `is_corrupted`     | Validator có bị corrupted không                                 |

### Cấu hình

Các thông số có thể thay đổi trong hàm `main()`:

```python
CONFIG = {
    "n_epochs": 10000,          # Số epochs chạy
    "n_peers": 50,              # Số validators ban đầu
    "n_corrupted": 5,           # Số validators corrupted
    "initial_stake_volume": 5000.0,
    "starting_gini": 0.3,       # Gini ban đầu
    "reward": 20.0,             # Phần thưởng mỗi block
    "target_entity_id": 0,      # Entity ID sẽ thực hiện sybil
    "sybil_epoch": 5000,        # Epoch thực hiện sybil attack
    "num_splits": 3,            # Số validators sau khi split
}
```

### Ví dụ Output

```
Target Entity ID: 0
  Không có Sybil Attack: 487 lần được chọn
  Có Sybil Attack:       512 lần được chọn
  Chênh lệch:            +25 lần
  Phần trăm thay đổi:    +5.13%
```

### Phân tích kết quả

Từ output, bạn có thể:

1. **So sánh giữa 2 consensus**: WEIGHTED vs DESW
2. **Xem impact của Sybil Attack**: Tổng số lần được chọn tăng/giảm bao nhiêu
3. **Phân tích chi tiết**: Xem từng epoch, validator nào được chọn, stake thay đổi ra sao
4. **Đánh giá tính công bằng**: Consensus nào chống sybil tốt hơn

### Notes

- Script sử dụng cùng random seed (42) để đảm bảo initial conditions giống nhau
- Sybil attack được thực hiện ở giữa chừng (epoch 5000 trong 10000 epochs)
- Tất cả metrics decentralization (Gini, Nakamoto, HHI, v.v.) đều được tính

---

## 2. multi_scenario_comparison.py

Script nâng cao để so sánh nhiều kịch bản khác nhau.

### Mục đích

Chạy **nhiều kịch bản** với các thông số khác nhau để phân tích toàn diện:

1. **Validator giàu vs nghèo**: Target entity giàu nhất vs nghèo nhất
2. **Timing khác nhau**: Sybil attack sớm (epoch 2000) vs muộn (epoch 8000) vs giữa (epoch 5000)
3. **Số lượng splits**: 2, 3, 5, 10 validators
4. **2 consensus**: WEIGHTED vs DESW

**Tổng cộng**: 5 scenarios × 2 consensus × 2 versions (with/without sybil) = 20 simulations

### Các Scenarios

| Scenario           | Mô tả                        | Target  | Sybil Epoch | Num Splits |
| ------------------ | ---------------------------- | ------- | ----------- | ---------- |
| `rich_early_split` | Validator giàu, split sớm    | Richest | 2000        | 3          |
| `rich_late_split`  | Validator giàu, split muộn   | Richest | 8000        | 3          |
| `poor_mid_split`   | Validator nghèo, split giữa  | Poorest | 5000        | 3          |
| `rich_many_splits` | Validator giàu, nhiều splits | Richest | 5000        | 10         |
| `rich_few_splits`  | Validator giàu, ít splits    | Richest | 5000        | 2          |

### Cách chạy

```bash
cd pos_simulator_python/experiments/scripts
python multi_scenario_comparison.py
```

### Output

Script tạo các files trong `results/multi_scenario/`:

1. **`multi_scenario_summary_<timestamp>.csv`**: Bảng tóm tắt tất cả scenarios

   - Columns: scenario, consensus, selections_no_sybil, selections_with_sybil, difference, percentage_change

2. **`multi_scenario_detailed_<timestamp>.json`**: Chi tiết JSON của tất cả scenarios

3. **Individual CSV files**: Một file CSV cho mỗi scenario + consensus combination (with sybil)
   - Format: `{scenario_name}_{consensus}_WITH_SYBIL_{timestamp}.csv`

### Ví dụ Output Console

```
BẢNG SO SÁNH TỔNG HỢP
================================================================================

Scenario                            Consensus    No Sybil     With Sybil   Change
------------------------------------------------------------------------------------------
Rich Validator - Early Split        WEIGHTED     487          512          +25 (+5.13%)
Rich Validator - Early Split        DESW         495          508          +13 (+2.63%)

Rich Validator - Late Split         WEIGHTED     489          521          +32 (+6.54%)
Rich Validator - Late Split         DESW         492          502          +10 (+2.03%)

Poor Validator - Mid Split          WEIGHTED     78           82           +4 (+5.13%)
Poor Validator - Mid Split          DESW         81           83           +2 (+2.47%)

Rich Validator - Many Splits        WEIGHTED     485          548          +63 (+12.99%)
Rich Validator - Many Splits        DESW         491          519          +28 (+5.70%)

Rich Validator - Few Splits         WEIGHTED     488          502          +14 (+2.87%)
Rich Validator - Few Splits         DESW         493          498          +5 (+1.01%)
```

### Phân tích

Từ output, bạn có thể:

1. **So sánh consensus mechanisms**:
   - WEIGHTED vs DESW: Consensus nào dễ bị lợi dụng bởi sybil attack hơn?
2. **Ảnh hưởng của số lượng splits**:
   - Nhiều splits → tăng hay giảm khả năng được chọn?
3. **Ảnh hưởng của timing**:
   - Split sớm vs muộn → Impact khác nhau ra sao?
4. **Validator giàu vs nghèo**:
   - Validator giàu có lợi thế hơn khi sybil không?

### Customization

Để thêm scenarios mới, edit trong `run_all_scenarios()`:

```python
all_scenarios["your_scenario_name"] = self.compare_scenario(
    consensus_types,
    "Your Scenario Description",
    target_entity_id=5,      # Entity ID
    sybil_epoch=3000,        # Epoch to perform sybil
    num_splits=4,            # Number of splits
)
```

### Performance

- Mỗi scenario chạy 2 simulations (no sybil + with sybil)
- Mỗi simulation: 10,000 epochs
- Tổng time: ~5-10 phút (tùy hardware)
- Có thể giảm `n_epochs` trong CONFIG để test nhanh hơn
