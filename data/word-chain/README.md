# Dữ liệu nối từ NT-VI-1

Đã tải và lọc snapshot Underthesea ngày 13/11/2026. Game dùng bộ playable dẫn xuất dưới đây như **từ điển thử nghiệm**; đây không phải danh sách đã được thẩm định nghĩa đầy đủ. Nối từ dùng index này ở server; nếu file/hash sai thì chỉ Nối từ bị vô hiệu hóa, UNO tiếp tục hoạt động.

## Ứng viên đầu vào

| Bước | Số mục |
|---|---:|
| Mục từ gốc | 79.226 |
| Đúng hai phần cách nhau bằng khoảng trắng | 52.778 |
| Loại vì có chữ số/ký hiệu hoặc ký tự ngoài tập chữ cho phép | 293 |
| Mục còn lại trước loại trùng | 52.485 |
| Mục trùng sau chuẩn hóa được gộp | 587 |
| Ứng viên hai tiếng duy nhất | **51.898** |

## File

- `two-syllable-candidates.txt`: một mục ứng viên trên mỗi dòng.
- `two-syllable-candidates.jsonl`: ứng viên kèm `sources` và `originals`.
- `filter-report.json`: số lượng và SHA-256 của snapshot đã lọc.
- `curation.json`: version, allow/deny override có lý do, từ mồi và heuristic quarantine.
- `playable-words.txt`: danh sách runtime đã pin, một từ trên mỗi dòng.
- `playable-manifest.json`: hash/count/version/seed của runtime list.
- `quarantine-uppercase-only.jsonl`: các mục có dạng nguồn viết hoa duy nhất được tạm giữ để rà tên riêng.
- `semantic-review-queue-200.jsonl`: mẫu rà soát 200 mục, phân tầng theo tổ hợp nguồn, seed `20261113`. Các mục đang ở trạng thái `pending`; đây là hàng đợi cho người duyệt, không phải kết quả thẩm định.
- `source/underthesea/words.jsonl`: bản chụp nguồn từ `dictionary/words.txt`.
- `source/underthesea/provenance.json`, `UPSTREAM-README.md`, `UPSTREAM-LICENSE.txt`: URL, commit, đường dẫn nguồn, trạng thái quyền và tài liệu upstream.

## Quy tắc lọc

Chuẩn hóa Unicode NFC, chữ thường và khoảng trắng; chỉ giữ đúng hai phần. Mỗi phần chỉ chứa chữ Latin a–z hoặc chữ tiếng Việt trong tập cho phép; không nhận số, gạch nối, dấu câu hay ký tự khác. Gộp mục trùng và hợp nhất nguồn. Không đổi `i/y`, bỏ dấu hoặc tự sinh từ mới. Sắp xếp ổn định theo Unicode, không tuyên bố thứ tự từ điển tiếng Việt.

Đây là lọc hình thức, không phải bộ phân tích âm tiết hoặc kiểm định ngôn ngữ. Hai phần đều là chữ không tự chứng minh đó là cụm có nghĩa. Tên riêng dạng viết thường, từ cổ, địa phương, từ nước ngoài Latin và từ nhạy cảm có thể còn. Snapshot không có định nghĩa.

## Bộ playable thử nghiệm

Chạy Python 3 từ root repo, không cần dependency hoặc mạng:

```sh
python3 scripts/filter-vietnamese-dictionary.py
python3 scripts/build-playable-dictionary.py
```

Script thứ hai xác minh hash đầu vào, JSONL/TXT khớp, chuẩn hóa hai tiếng, allow/deny/seed hợp lệ rồi tạo output ổn định. Kết quả hiện pin vào version `underthesea-2c078cf-ntvi1-curation-1`:

| Mục | Số lượng |
|---|---:|
| Ứng viên đầu vào | 51.898 |
| Tạm quarantine do chỉ có dạng nguồn viết hoa | 4.021 |
| Allow override có ghi lý do | 4 |
| Deny override | 0 |
| Từ mồi có mục nối tiếp | 29 |
| Playable thử nghiệm | 47.877 |

SHA-256 playable: `67baf1b0516d02b271f7f54bcf247210c764696135cb71808d1441838ea133fa`.

Heuristic viết hoa có thể loại nhầm từ đầu câu và không phát hiện hết tên riêng dạng chữ thường. Đã chuẩn bị hàng đợi 200 mục phân tầng theo tổ hợp nguồn để người am hiểu rà, nhưng cả 200 mục vẫn `pending`; chưa hoàn tất thẩm định ngữ nghĩa. Không tuyên bố chất lượng ngôn ngữ toàn tập. Đây là rủi ro cần xử lý trước khi CLB dựa vào từ điển để xử thắng thua và trước khi phân phối công khai.

Ví dụ `lọc cọc` hiện có trong playable set (nguồn gốc gồm hongocduc, tudientv và Wiktionary), nên engine chấp nhận ngay và không mở vote. Các bài test vote dùng fixture không có từ được đề xuất.

## Nguồn và giấy phép

[Underthesea dictionary](https://github.com/undertheseanlp/dictionary), commit `2c078cfc373b06e2980d324ce1d7bd13740c3319`, file `dictionary/words.txt`. Nguồn thành phần trong bản gốc gồm Hồ Ngọc Đức, tudientv và Wiktionary; từng dòng giữ nhãn nguồn tương ứng.

README upstream tuyên bố GPL-3.0 cho **mã nguồn**. Chưa xác minh độc lập quyền sử dụng/phân phối của từng nguồn dữ liệu, nên không gán giấy phép mới hay khẳng định toàn bộ dữ liệu cùng giấy phép. Không coi dataset đã rõ quyền phân phối công khai.
