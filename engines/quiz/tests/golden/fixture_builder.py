"""
Golden Test Fixture Builder (TASK-13).
Programmatically generates 10 standardized synthetic/reference PDF test fixtures
using PyMuPDF for comprehensive regression benchmarking and fault layer verification.
"""

import os
import pymupdf
from typing import Any, Optional


def _create_sample_pixmap(width: int = 200, height: int = 150, color_rgb: tuple[int, int, int] = (100, 150, 200)) -> pymupdf.Pixmap:
    """Creates a simple colored pixmap for diagram/scan simulation."""
    pix = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, width, height), 0)
    r, g, b = color_rgb
    for y in range(height):
        for x in range(width):
            # Gradient pattern
            pix.set_pixel(x, y, (min(255, r + x // 4), min(255, g + y // 4), b))
    return pix


# -------------------------------------------------------------------------
# Fixture 1: GF-01-VEC (Standard Vector MCQ - 20 questions, 2 pages)
# -------------------------------------------------------------------------
def build_gf01_vector_mcq(file_path: str) -> dict[str, Any]:
    doc = pymupdf.open()
    
    # Page 1: Questions 1 to 10
    p1 = doc.new_page(width=595.28, height=841.89)
    p1.insert_text((50, 45), "SỞ GIÁO DỤC VÀ ĐÀO TẠO - ĐỀ KIỂM TRA CHẤT LƯỢNG HỌC KỲ I", fontsize=11)
    p1.insert_text((50, 60), "Môn: Hóa học 12 (Thời gian làm bài: 50 phút)", fontsize=9)
    p1.insert_text((50, 75), "Mã đề thi: 101", fontsize=9)
    
    y = 100
    for i in range(1, 11):
        p1.insert_text((50, y), f"Câu {i}: Chất nào sau đây là este no, đơn chức, mạch hở?", fontsize=10)
        y += 18
        p1.insert_text((50, y), "A. CH3COOCH3    B. C6H5COOCH3    C. CH2=CHCOOCH3    D. CH3COOH", fontsize=9)
        y += 28

    # Page 2: Questions 11 to 20
    p2 = doc.new_page(width=595.28, height=841.89)
    p2.insert_text((50, 45), "ĐỀ KIỂM TRA HÓA HỌC 12 - TRANG 2", fontsize=10)
    y = 80
    for i in range(11, 21):
        p2.insert_text((50, y), f"Câu {i}: Thủy phân este X trong dung dịch kiềm đun nóng gọi là phản ứng gì?", fontsize=10)
        y += 18
        p2.insert_text((50, y), "A. Phản ứng xà phòng hóa.    B. Phản ứng este hóa.    C. Phản ứng trùng ngưng.    D. Phản ứng tráng bạc.", fontsize=9)
        y += 28

    doc.save(file_path)
    doc.close()

    return {
        "fixture_id": "GF-01-VEC",
        "name": "Standard Vector MCQ Exam",
        "file_path": file_path,
        "expected_questions": 20,
        "expected_pages": 2,
        "is_scanned": False,
        "has_images": False,
        "question_types": ["part_i_mcq"],
        "target_recall": 1.0,
    }


# -------------------------------------------------------------------------
# Fixture 2: GF-02-SCN (Pure Scan - 1 page raster image, no text layer)
# -------------------------------------------------------------------------
def build_gf02_pure_scan(file_path: str) -> dict[str, Any]:
    doc = pymupdf.open()
    p = doc.new_page(width=595.28, height=841.89)
    # Insert large raster pixmap filling 90% of page area, NO text inserted
    pix = _create_sample_pixmap(width=500, height=700, color_rgb=(230, 230, 230))
    p.insert_image(pymupdf.Rect(40, 50, 555, 790), pixmap=pix)

    doc.save(file_path)
    doc.close()

    return {
        "fixture_id": "GF-02-SCN",
        "name": "Pure Scanned Document",
        "file_path": file_path,
        "expected_questions": 0,
        "expected_pages": 1,
        "is_scanned": True,
        "has_images": True,
        "expected_error": "PDF_SCAN_TOO_LOW_QUALITY",
        "expected_layer": "PDF_PARSING_FAILURE",
    }


# -------------------------------------------------------------------------
# Fixture 3: GF-03-MIX (Mixed Document with Experimental Diagram)
# -------------------------------------------------------------------------
def build_gf03_mixed_diagram(file_path: str) -> dict[str, Any]:
    doc = pymupdf.open()
    p = doc.new_page(width=595.28, height=841.89)
    p.insert_text((50, 50), "BÀI TẬP HÓA HỌC THỰC NGHIỆM - SƠ ĐỒ THÍ NGHIỆM", fontsize=11)
    
    # Question 1 with embedded diagram image
    p.insert_text((50, 80), "Câu 1: Cho hình vẽ mô tả thí nghiệm điều chế este etyl axetat trong phòng thí nghiệm:", fontsize=10)
    pix = _create_sample_pixmap(width=240, height=120, color_rgb=(180, 210, 240))
    p.insert_image(pymupdf.Rect(60, 95, 300, 215), pixmap=pix)
    p.insert_text((50, 230), "A. Vai trò của H2SO4 đặc là xúc tác và hút nước.", fontsize=9)
    p.insert_text((50, 245), "B. Dẫn hơi este vào dung dịch NaCl bão hòa để tách este.", fontsize=9)
    p.insert_text((50, 260), "C. Ống nghiệm hứng este được đặt trong cốc nước đá.", fontsize=9)
    p.insert_text((50, 275), "D. Thay ancol etylic bằng ancol metylic thì hiện tượng không đổi.", fontsize=9)

    # Question 2
    p.insert_text((50, 310), "Câu 2: Trong thí nghiệm trên, chất lỏng thu được trong ống nghiệm hứng gồm những chất nào?", fontsize=10)
    p.insert_text((50, 330), "A. Etyl axetat.    B. Etyl axetat, axit axetic và ancol etylic.    C. Chỉ có axit.    D. Hỗn hợp khí.", fontsize=9)

    # Question 3
    p.insert_text((50, 365), "Câu 3: Mục đích chính của việc thêm dung dịch NaCl bão hòa vào ống nghiệm hứng là gì?", fontsize=10)
    p.insert_text((50, 385), "A. Làm giảm độ tan của este.    B. Làm tăng khối lượng riêng của nước.    C. Cả A và B.    D. Không có tác dụng.", fontsize=9)

    # Questions 4 & 5
    p.insert_text((50, 420), "Câu 4: Nhiệt kế cắm vào bình cầu để kiểm soát nhiệt độ phản ứng ở khoảng bao nhiêu?", fontsize=10)
    p.insert_text((50, 440), "A. 140°C.    B. 100°C.    C. 65°C - 70°C.    D. 200°C.", fontsize=9)

    p.insert_text((50, 475), "Câu 5: Đá bọt được thêm vào bình cầu nhằm mục đích gì?", fontsize=10)
    p.insert_text((50, 495), "A. Giúp chất lỏng sôi đều.    B. Làm chất xúc tác.    C. Tăng tốc độ phản ứng.    D. Giảm mùi.", fontsize=9)

    doc.save(file_path)
    doc.close()

    return {
        "fixture_id": "GF-03-MIX",
        "name": "Mixed Document With Diagram",
        "file_path": file_path,
        "expected_questions": 5,
        "expected_pages": 1,
        "is_scanned": False,
        "has_images": True,
        "question_types": ["part_i_mcq"],
        "target_recall": 1.0,
    }


# -------------------------------------------------------------------------
# Fixture 4: GF-04-SPL (Split-Page Question Boundary)
# -------------------------------------------------------------------------
def build_gf04_split_page(file_path: str) -> dict[str, Any]:
    doc = pymupdf.open()
    
    # Page 1: Questions 1 to 4 and Stem of Question 5 near the bottom
    p1 = doc.new_page(width=595.28, height=841.89)
    p1.insert_text((50, 50), "ĐỀ THI THỬ THPT QUỐC GIA - TRANG 1", fontsize=11)
    
    y = 80
    for i in range(1, 5):
        p1.insert_text((50, y), f"Câu {i}: Este nào sau đây có mùi thơm của hoa nhài?", fontsize=10)
        y += 18
        p1.insert_text((50, y), "A. Benzyl axetat.    B. Isoamyl axetat.    C. Etyl fomat.    D. Geranyl axetat.", fontsize=9)
        y += 35

    # Stem of Question 5 placed at bottom of Page 1
    p1.insert_text((50, 785), "Câu 5: Cho các nhận định sau về phản ứng xà phòng hóa chất béo trong môi trường kiềm:", fontsize=10)

    # Page 2: Options for Question 5 at top of page, followed by Questions 6 and 7
    p2 = doc.new_page(width=595.28, height=841.89)
    p2.insert_text((50, 45), "ĐỀ THI THỬ THPT QUỐC GIA - TRANG 2", fontsize=10)
    
    p2.insert_text((50, 70), "A. Luôn sinh ra glixerol và muối của axit béo.", fontsize=9)
    p2.insert_text((50, 85), "B. Là phản ứng thuận nghịch hai chiều.", fontsize=9)
    p2.insert_text((50, 100), "C. Có thể dùng để sản xuất xà phòng trong công nghiệp.", fontsize=9)
    p2.insert_text((50, 115), "D. Muối thu được tan tốt trong dung dịch NaCl bão hòa.", fontsize=9)

    p2.insert_text((50, 150), "Câu 6: Chất béo triolein có bao nhiêu liên kết pi (π) trong phân tử?", fontsize=10)
    p2.insert_text((50, 170), "A. 3.    B. 6.    C. 4.    D. 5.", fontsize=9)

    p2.insert_text((50, 205), "Câu 7: Khối lượng mol phân tử của tristearin là bao nhiêu g/mol?", fontsize=10)
    p2.insert_text((50, 225), "A. 890.    B. 884.    C. 806.    D. 856.", fontsize=9)

    doc.save(file_path)
    doc.close()

    return {
        "fixture_id": "GF-04-SPL",
        "name": "Split-Page Question Boundary",
        "file_path": file_path,
        "expected_questions": 7,
        "expected_pages": 2,
        "is_scanned": False,
        "has_images": False,
        "split_question_number": 5,
        "target_recall": 1.0,
    }


# -------------------------------------------------------------------------
# Fixture 5: GF-05-CHM (Chemistry Formulas & KaTeX)
# -------------------------------------------------------------------------
def build_gf05_chemistry_formulas(file_path: str) -> dict[str, Any]:
    doc = pymupdf.open()
    p = doc.new_page(width=595.28, height=841.89)
    p.insert_text((50, 50), "CHUYÊN ĐỀ HÓA HỌC: CÔNG THỨC VÀ PHẢN ỨNG HỮU CƠ", fontsize=11)
    
    questions_data = [
        ("Câu 1: Este X no đơn chức mạch hở có công thức tổng quát là $C_nH_{2n}O_2$ với điều kiện nào?",
         "A. $n \\ge 2$    B. $n \\ge 3$    C. $n \\ge 1$    D. $n \\ge 4$"),
        ("Câu 2: Cho phản ứng: $CH_3COOCH_3 + NaOH \\to CH_3COONa + CH_3OH$. Đây là phản ứng gì?",
         "A. Phản ứng xà phòng hóa.    B. Phản ứng este hóa.    C. Phản ứng thế.    D. Phản ứng cộng."),
        ("Câu 3: Đốt cháy hoàn toàn este X thu được $n_{CO_2} = n_{H_2O}$. Kết luận nào đúng về X?",
         "A. X là este no đơn chức mạch hở.    B. X là este không no.    C. X là este 2 chức.    D. X là este thơm."),
        ("Câu 4: Thủy phân $CH_2=CHCOOCH_3$ trong dung dịch kiềm thu được ancol nào?",
         "A. $CH_3OH$    B. $CH_2=CHOH$    C. $CH_3CHO$    D. $C_2H_5OH$"),
        ("Câu 5: Công thức hóa học của triolein là chất nào sau đây?",
         "A. $(C_{17}H_{33}COO)_3C_3H_5$    B. $(C_{17}H_{35}COO)_3C_3H_5$    C. $(C_{15}H_{31}COO)_3C_3H_5$    D. $(C_{17}H_{31}COO)_3C_3H_5$"),
        ("Câu 6: Cho 0,1 mol $CH_3COOC_2H_5$ tác dụng hết với dung dịch chứa 0,15 mol NaOH thu được bao nhiêu gam muối?",
         "A. 8,2 gam.    B. 12,3 gam.    C. 6,8 gam.    D. 9,4 gam."),
        ("Câu 7: Este tạo bởi axit fomic $HCOOH$ và ancol etylic $C_2H_5OH$ có công thức cấu tạo là gì?",
         "A. $HCOOC_2H_5$    B. $CH_3COOCH_3$    C. $C_2H_5COOH$    D. $CH_3COOC_2H_5$"),
        ("Câu 8: Công thức phân tử của metyl fomat là gì?",
         "A. $C_2H_4O_2$    B. $C_3H_6O_2$    C. $C_4H_8O_2$    D. $CH_2O_2$"),
        ("Câu 9: Chất béo lỏng chứa chủ yếu các gốc axit béo nào sau đây?",
         "A. Axit béo không no.    B. Axit béo no.    C. Axit vô cơ.    D. Axit fomic."),
        ("Câu 10: Xà phòng hóa hoàn toàn tristearin thu được glixerol và muối có công thức là gì?",
         "A. $C_{17}H_{35}COONa$    B. $C_{17}H_{33}COONa$    C. $C_{15}H_{31}COONa$    D. $CH_3COONa$"),
    ]

    y = 80
    for stem, opts in questions_data:
        p.insert_text((50, y), stem, fontsize=9.5)
        y += 18
        p.insert_text((50, y), opts, fontsize=9)
        y += 32

    doc.save(file_path)
    doc.close()

    return {
        "fixture_id": "GF-05-CHM",
        "name": "Chemistry Formulas & KaTeX Math",
        "file_path": file_path,
        "expected_questions": 10,
        "expected_pages": 1,
        "has_formulas": True,
        "is_scanned": False,
        "target_recall": 1.0,
    }


# -------------------------------------------------------------------------
# Fixture 6: GF-06-LNG (Long Options - 1-Column Layout Enforced)
# -------------------------------------------------------------------------
def build_gf06_long_options(file_path: str) -> dict[str, Any]:
    doc = pymupdf.open()
    p = doc.new_page(width=595.28, height=841.89)
    p.insert_text((50, 45), "BÀI TẬP VỀ LÝ THUYẾT ĐỒNG PHÂN VÀ TÍNH CHẤT HÓA HỌC", fontsize=11)
    
    y = 75
    for i in range(1, 6):
        p.insert_text((50, y), f"Câu {i}: Phát biểu nào sau đây về tính chất vật lý và hóa học của este là hoàn toàn chính xác?", fontsize=10)
        y += 18
        p.insert_text((50, y), "A. Các este thường là chất lỏng hoặc chất rắn ở nhiệt độ thường, nhẹ hơn nước, rất ít tan trong nước do không tạo được liên kết hiđro với các phân tử nước.", fontsize=8.5)
        y += 15
        p.insert_text((50, y), "B. Nhiệt độ sôi của các este thấp hơn hẳn so với các axit và ancol có cùng khối lượng mol phân tử do giữa các phân tử este không tồn tại liên kết hiđro liên phân tử.", fontsize=8.5)
        y += 15
        p.insert_text((50, y), "C. Phản ứng thủy phân este trong môi trường kiềm luôn là phản ứng thuận nghịch hai chiều và nhiệt độ phản ứng cần duy trì trên 100 độ C để tạo xà phòng.", fontsize=8.5)
        y += 15
        p.insert_text((50, y), "D. Tất cả các este khi phản ứng với dung dịch kiềm dư đun nóng đều thu được sản phẩm hữu cơ cuối cùng là một muối của axit cacboxylic và một ancol tương ứng.", fontsize=8.5)
        y += 28

    doc.save(file_path)
    doc.close()

    return {
        "fixture_id": "GF-06-LNG",
        "name": "Long Options 1-Column Enforcement",
        "file_path": file_path,
        "expected_questions": 5,
        "expected_pages": 1,
        "long_options": True,
        "is_scanned": False,
        "expected_column_mode": 1,
        "target_recall": 1.0,
    }


# -------------------------------------------------------------------------
# Fixture 7: GF-07-TBL (Experimental Data Tables)
# -------------------------------------------------------------------------
def build_gf07_data_tables(file_path: str) -> dict[str, Any]:
    doc = pymupdf.open()
    p = doc.new_page(width=595.28, height=841.89)
    p.insert_text((50, 45), "BÀI TẬP HÓA HỌC THỰC NGHIỆM VÀ BẢNG SỐ LIỆU", fontsize=11)
    
    p.insert_text((50, 75), "Câu 1: Cho bảng số liệu nhiệt độ sôi của một số chất hữu cơ có cùng số nguyên tử cacbon:", fontsize=10)
    p.insert_text((60, 95), "Chất               Công thức            Nhiệt độ sôi (°C)", fontsize=9)
    p.insert_text((60, 110), "Etyl fomat         HCOOC2H5             54,0", fontsize=9)
    p.insert_text((60, 125), "Ancol propylic     C3H7OH               97,2", fontsize=9)
    p.insert_text((60, 140), "Axit axetic        CH3COOH              118,2", fontsize=9)
    p.insert_text((50, 160), "Thứ tự tăng dần nhiệt độ sôi của các chất là:", fontsize=9.5)
    p.insert_text((50, 178), "A. Este < Ancol < Axit.    B. Axit < Ancol < Este.    C. Ancol < Este < Axit.    D. Este < Axit < Ancol.", fontsize=9)

    p.insert_text((50, 215), "Câu 2: Kết quả thí nghiệm của các dung dịch X, Y, Z với thuốc thử được ghi ở bảng sau:", fontsize=10)
    p.insert_text((60, 235), "Chất thử           Thuốc thử                   Hiện tượng", fontsize=9)
    p.insert_text((60, 250), "Dung dịch X        Dung dịch AgNO3 trong NH3   Kết tủa Ag trắng sáng", fontsize=9)
    p.insert_text((60, 265), "Dung dịch Y        Cu(OH)2 ở nhiệt độ thường   Dung dịch màu xanh lam", fontsize=9)
    p.insert_text((60, 280), "Dung dịch Z        Nước brom                   Mất màu nước brom", fontsize=9)
    p.insert_text((50, 300), "Các chất X, Y, Z lần lượt là:", fontsize=9.5)
    p.insert_text((50, 318), "A. Glucozơ, glixerol, triolein.    B. Fructozơ, etanol, tristearin.    C. Saccarozơ, axit axetic, triolein.    D. Ancol etylic, glucozơ, tripanmitin.", fontsize=9)

    p.insert_text((50, 355), "Câu 3: Đun nóng chất hữu cơ X với dung dịch NaOH thu được glixerol. X là chất nào?", fontsize=10)
    p.insert_text((50, 375), "A. Chất béo.    B. Este đơn chức.    C. Etyl axetat.    D. Ancol metylic.", fontsize=9)

    p.insert_text((50, 410), "Câu 4: Xà phòng hóa tripanmitin thu được muối có công thức là gì?", fontsize=10)
    p.insert_text((50, 430), "A. C15H31COONa.    B. C17H35COONa.    C. C17H33COONa.    D. C17H31COONa.", fontsize=9)

    doc.save(file_path)
    doc.close()

    return {
        "fixture_id": "GF-07-TBL",
        "name": "Experimental Data Tables",
        "file_path": file_path,
        "expected_questions": 4,
        "expected_pages": 1,
        "has_tables": True,
        "is_scanned": False,
        "target_recall": 1.0,
    }


# -------------------------------------------------------------------------
# Fixture 8: GF-08-3PT (3-Part Exam Taxonomy: MCQ + TF + Short Answer)
# -------------------------------------------------------------------------
def build_gf08_three_part(file_path: str) -> dict[str, Any]:
    doc = pymupdf.open()
    p = doc.new_page(width=595.28, height=841.89)
    
    p.insert_text((50, 40), "ĐỀ THI TỐT NGHIỆP THPT THEO CẤU TRÚC MỚI", fontsize=11)
    
    # Part I: MCQ (Questions 1 - 4)
    p.insert_text((50, 65), "PHAN I (PHẦN I). Câu trắc nghiệm nhiều phương án lựa chọn (Thí sinh trả lời từ câu 1 đến câu 4)", fontsize=9.5)
    y = 85
    for i in range(1, 5):
        p.insert_text((50, y), f"Câu {i}: Chất nào sau đây thuộc loại este no, đơn chức mạch hở?", fontsize=9)
        y += 16
        p.insert_text((50, y), "A. Etyl axetat    B. Metyl acrylat    C. Vinyl axetat    D. Phenyl axetat", fontsize=8.5)
        y += 24

    # Part II: True / False (Questions 5 - 6)
    p.insert_text((50, y + 10), "PHAN II (PHẦN II). Câu trắc nghiệm đúng sai (Thí sinh trả lời câu 5 và câu 6. Trong mỗi ý a, b, c, d chọn đúng hoặc sai)", fontsize=9.5)
    y += 30
    p.insert_text((50, y), "Câu 5: Cho các nhận định sau về este và chất béo:", fontsize=9)
    y += 16
    p.insert_text((60, y), "a) Chất béo nhẹ hơn nước và không tan trong nước.", fontsize=8.5)
    y += 14
    p.insert_text((60, y), "b) Triolein có phản ứng cộng hiđro tạo thành tristearin.", fontsize=8.5)
    y += 14
    p.insert_text((60, y), "c) Phản ứng xà phòng hóa chất béo là phản ứng thuận nghịch.", fontsize=8.5)
    y += 14
    p.insert_text((60, y), "d) Dầu mỡ động thực vật có cùng thành phần với dầu mỡ bôi trơn máy.", fontsize=8.5)
    y += 22

    p.insert_text((50, y), "Câu 6: Cho các phát biểu sau về phản ứng este hóa giữa axit axetic và ancol etylic:", fontsize=9)
    y += 16
    p.insert_text((60, y), "a) Axit sunfuric đặc có vai trò làm chất xúc tác và hút nước.", fontsize=8.5)
    y += 14
    p.insert_text((60, y), "b) Để nâng cao hiệu suất phản ứng có thể lấy dư một trong hai chất phản ứng.", fontsize=8.5)
    y += 14
    p.insert_text((60, y), "c) Dung dịch NaCl bão hòa được dùng để tách este ra khỏi hỗn hợp.", fontsize=8.5)
    y += 14
    p.insert_text((60, y), "d) Phản ứng este hóa là phản ứng hoàn toàn một chiều.", fontsize=8.5)
    y += 24

    # Part III: Short Answer (Questions 7 - 8)
    p.insert_text((50, y + 10), "PHAN III (PHẦN III). Câu trắc nghiệm trả lời ngắn (Thí sinh trả lời câu 7 và câu 8)", fontsize=9.5)
    y += 30
    p.insert_text((50, y), "Câu 7: Có bao nhiêu este đồng phân cấu tạo có công thức phân tử C4H8O2?", fontsize=9)
    y += 26
    p.insert_text((50, y), "Câu 8: Thủy phân hoàn toàn 17,6 gam etyl axetat trong dung dịch NaOH đun nóng thu được m gam muối. Giá trị của m là bao nhiêu?", fontsize=9)

    doc.save(file_path)
    doc.close()

    return {
        "fixture_id": "GF-08-3PT",
        "name": "3-Part Exam Taxonomy",
        "file_path": file_path,
        "expected_questions": 8,
        "expected_pages": 1,
        "has_3_parts": True,
        "sections": ["part_i_mcq", "part_ii_tf", "part_iii_short"],
        "is_scanned": False,
        "target_recall": 1.0,
    }


# -------------------------------------------------------------------------
# Fixture 9: GF-09-ADV (Adversarial Distractors & Natural Numbers)
# -------------------------------------------------------------------------
def build_gf09_adversarial_distractors(file_path: str) -> dict[str, Any]:
    doc = pymupdf.open()
    p = doc.new_page(width=595.28, height=841.89)
    
    p.insert_text((50, 40), "TRƯỜNG THPT CHUYÊN - TRANG 1/1 - MÃ ĐỀ THI 109", fontsize=10)
    p.insert_text((50, 60), "Lưu ý: Thí sinh làm bài trong 50 phút. Không sử dụng tài liệu.", fontsize=8.5)
    
    # Question 1: Distractor "Vitamin A." inside text
    p.insert_text((50, 90), "Câu 1: Vitamin A. là một hợp chất hữu cơ thiết yếu có chứa nhóm chức ancol. Chất nào sau đây tác dụng với axit axetic tạo este?", fontsize=9.5)
    p.insert_text((50, 108), "A. Metanol.    B. Khí metan.    C. Benzen.    D. Axit fomic.", fontsize=9)

    # Question 2: Distractor with percentages and numbers
    p.insert_text((50, 140), "Câu 2: Hòa tan 10.5g hỗn hợp este trong 100ml dung dịch NaOH 10%. Chất béo nào sau đây ở thể rắn ở nhiệt độ thường?", fontsize=9.5)
    p.insert_text((50, 158), "A. Tristearin.    B. Triolein.    C. Trilinolein.    D. Etyl fomat.", fontsize=9)

    # Question 3: Distractor option markers inside stem
    p.insert_text((50, 190), "Câu 3: Cho các chất: A. Ancol etylic, B. Axit axetic, C. Etyl axetat. Chất có nhiệt độ sôi thấp nhất là chất nào?", fontsize=9.5)
    p.insert_text((50, 208), "A. Etyl axetat.    B. Ancol etylic.    C. Axit axetic.    D. Nước.", fontsize=9)

    # Question 4: Distractor footer-like text
    p.insert_text((50, 240), "Câu 4: Đun nóng este với dung dịch kiềm gọi là phản ứng gì?", fontsize=9.5)
    p.insert_text((50, 258), "A. Phản ứng xà phòng hóa.    B. Phản ứng este hóa.    C. Phản ứng thế.    D. Phản ứng cộng.", fontsize=9)

    p.insert_text((50, 300), "--- HẾT --- Cán bộ coi thi không giải thích gì thêm.", fontsize=9)

    doc.save(file_path)
    doc.close()

    return {
        "fixture_id": "GF-09-ADV",
        "name": "Adversarial Distractors",
        "file_path": file_path,
        "expected_questions": 4,
        "expected_pages": 1,
        "is_scanned": False,
        "adversarial": True,
        "target_recall": 1.0,
    }


# -------------------------------------------------------------------------
# Fixture 10: GF-10-EST (Comprehensive Reference Ester & Lipid Exam)
# -------------------------------------------------------------------------
def build_gf10_ester_reference(file_path: str) -> dict[str, Any]:
    doc = pymupdf.open()
    
    # Page 1: Questions 1 to 12
    p1 = doc.new_page(width=595.28, height=841.89)
    p1.insert_text((50, 40), "BỘ GIÁO DỤC VÀ ĐÀO TẠO - ĐỀ THI THAM KHẢO CHUYÊN ĐỀ ESTE - LIPIT", fontsize=11)
    p1.insert_text((50, 56), "Môn: Hóa học 12 (Đề chuẩn cấu trúc quy chuẩn)", fontsize=9)
    
    y = 80
    for i in range(1, 13):
        p1.insert_text((50, y), f"Câu {i}: Este tạo bởi axit fomic và ancol metylic có tên gọi là gì?", fontsize=9.5)
        y += 16
        p1.insert_text((50, y), "A. Metyl fomat    B. Etyl axetat    C. Propyl fomat    D. Etyl fomat", fontsize=9)
        y += 24

    # Page 2: Questions 13 to 24
    p2 = doc.new_page(width=595.28, height=841.89)
    p2.insert_text((50, 40), "ĐỀ THI THAM KHẢO CHUYÊN ĐỀ ESTE - LIPIT (TIẾP THEO) - TRANG 2", fontsize=10)
    
    y = 75
    for i in range(13, 25):
        p2.insert_text((50, y), f"Câu {i}: Chất nào sau đây khi thủy phân trong môi trường kiềm cho glixerol?", fontsize=9.5)
        y += 16
        p2.insert_text((50, y), "A. Tristearin    B. Metyl axetat    C. Etyl fomat    D. Benzyl axetat", fontsize=9)
        y += 24

    doc.save(file_path)
    doc.close()

    return {
        "fixture_id": "GF-10-EST",
        "name": "Reference Ester & Lipid Exam",
        "file_path": file_path,
        "expected_questions": 24,
        "expected_pages": 2,
        "is_scanned": False,
        "is_reference": True,
        "target_recall": 1.0,
    }


# -------------------------------------------------------------------------
# Fixture Registry and Factory
# -------------------------------------------------------------------------
FIXTURE_BUILDERS = {
    "GF-01-VEC": build_gf01_vector_mcq,
    "GF-02-SCN": build_gf02_pure_scan,
    "GF-03-MIX": build_gf03_mixed_diagram,
    "GF-04-SPL": build_gf04_split_page,
    "GF-05-CHM": build_gf05_chemistry_formulas,
    "GF-06-LNG": build_gf06_long_options,
    "GF-07-TBL": build_gf07_data_tables,
    "GF-08-3PT": build_gf08_three_part,
    "GF-09-ADV": build_gf09_adversarial_distractors,
    "GF-10-EST": build_gf10_ester_reference,
}


def build_fixture(fixture_id: str, output_path: str) -> dict[str, Any]:
    """Builds a single golden fixture by ID."""
    if fixture_id not in FIXTURE_BUILDERS:
        raise ValueError(f"Unknown fixture ID '{fixture_id}'. Valid IDs: {list(FIXTURE_BUILDERS.keys())}")
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    return FIXTURE_BUILDERS[fixture_id](output_path)


def build_all_fixtures(output_dir: str) -> dict[str, dict[str, Any]]:
    """Builds all 10 golden fixtures in the specified directory."""
    os.makedirs(output_dir, exist_ok=True)
    results = {}
    for fix_id, builder in FIXTURE_BUILDERS.items():
        out_file = os.path.join(output_dir, f"{fix_id.lower().replace('-', '_')}.pdf")
        meta = builder(out_file)
        results[fix_id] = meta
    return results
