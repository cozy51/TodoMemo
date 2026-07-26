import json
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "TodoMemo_Manual_JA.pdf"
SHOTS = ROOT / "tmp" / "pdfs" / "screenshots"
ICON = ROOT / "assets" / "icons" / "todomemo-icon-1024.png"
MANIFEST = ROOT / "manifest.json"

PAGE_W, PAGE_H = landscape(A4)
MARGIN = 42

FONT_REGULAR = "BIZUDGothic"
FONT_BOLD = "BIZUDGothicBold"

NAVY = colors.HexColor("#172033")
BLUE = colors.HexColor("#2F6FED")
BLUE_DARK = colors.HexColor("#2359C4")
BLUE_SOFT = colors.HexColor("#EAF1FF")
MUTED = colors.HexColor("#68738A")
LINE = colors.HexColor("#DCE4F2")
PAPER = colors.HexColor("#F5F8FF")
WHITE = colors.white
ORANGE = colors.HexColor("#F28B35")
CORAL = colors.HexColor("#FF6045")
ORANGE_SOFT = colors.HexColor("#FFF2DE")
RED = colors.HexColor("#B4483D")
GREEN = colors.HexColor("#27805E")


def register_fonts():
    pdfmetrics.registerFont(TTFont(
        FONT_REGULAR,
        "C:/Windows/Fonts/BIZ-UDGothicR.ttc",
    ))
    pdfmetrics.registerFont(TTFont(
        FONT_BOLD,
        "C:/Windows/Fonts/BIZ-UDGothicB.ttc",
    ))


def wrap_text(text, font_name, font_size, max_width):
    lines = []
    current = ""
    for char in str(text):
        if char == "\n":
            lines.append(current)
            current = ""
            continue
        candidate = current + char
        if current and pdfmetrics.stringWidth(
            candidate, font_name, font_size
        ) > max_width:
            lines.append(current)
            current = char
        else:
            current = candidate
    if current or not lines:
        lines.append(current)
    return lines


def draw_text(c, text, x, y, max_width, font=FONT_REGULAR,
              size=11, color=NAVY, leading=None, max_lines=None):
    leading = leading or size * 1.55
    lines = wrap_text(text, font, size, max_width)
    if max_lines:
        lines = lines[:max_lines]
    c.setFont(font, size)
    c.setFillColor(color)
    cursor = y
    for line in lines:
        c.drawString(x, cursor, line)
        cursor -= leading
    return cursor


def draw_footer(c, page, total, version):
    c.setStrokeColor(LINE)
    c.setLineWidth(0.7)
    c.line(MARGIN, 27, PAGE_W - MARGIN, 27)
    c.setFont(FONT_REGULAR, 7.5)
    c.setFillColor(MUTED)
    c.drawString(MARGIN, 13, f"TodoMemo v{version}  |  かんたん操作マニュアル")
    c.drawRightString(PAGE_W - MARGIN, 13, f"{page} / {total}")


def draw_section_header(c, label, title, subtitle=None):
    c.setFillColor(BLUE)
    c.setFont(FONT_BOLD, 8)
    c.drawString(MARGIN, PAGE_H - 42, label)
    c.setFillColor(NAVY)
    c.setFont(FONT_BOLD, 23)
    c.drawString(MARGIN, PAGE_H - 70, title)
    if subtitle:
        draw_text(
            c, subtitle, MARGIN, PAGE_H - 91, PAGE_W - MARGIN * 2,
            size=9.5, color=MUTED, leading=14,
        )


def draw_image_contain(c, path, x, y, width, height,
                       background=WHITE, border=True, padding=8):
    c.setFillColor(colors.HexColor("#D9E2F1"))
    c.roundRect(x + 4, y - 4, width, height, 10, fill=1, stroke=0)
    c.setFillColor(background)
    c.roundRect(x, y, width, height, 10, fill=1, stroke=0)
    if border:
        c.setStrokeColor(LINE)
        c.setLineWidth(0.8)
        c.roundRect(x, y, width, height, 10, fill=0, stroke=1)

    image = ImageReader(str(path))
    image_w, image_h = image.getSize()
    usable_w = width - padding * 2
    usable_h = height - padding * 2
    scale = min(usable_w / image_w, usable_h / image_h)
    draw_w = image_w * scale
    draw_h = image_h * scale
    draw_x = x + (width - draw_w) / 2
    draw_y = y + (height - draw_h) / 2
    c.drawImage(
        image, draw_x, draw_y, draw_w, draw_h,
        preserveAspectRatio=True, mask="auto",
    )


def draw_step(c, number, title, body, x, y, width):
    c.setFillColor(BLUE)
    c.circle(x + 13, y - 3, 13, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont(FONT_BOLD, 10)
    c.drawCentredString(x + 13, y - 7, str(number))
    c.setFillColor(NAVY)
    c.setFont(FONT_BOLD, 11)
    c.drawString(x + 36, y + 1, title)
    end_y = draw_text(
        c, body, x + 36, y - 17, width - 36,
        size=8.5, color=MUTED, leading=13,
    )
    return end_y - 12


def draw_card(c, x, y, width, height, title, body,
              accent=BLUE, fill=WHITE, title_size=10):
    c.setFillColor(fill)
    c.roundRect(x, y, width, height, 10, fill=1, stroke=0)
    c.setStrokeColor(LINE)
    c.setLineWidth(0.8)
    c.roundRect(x, y, width, height, 10, fill=0, stroke=1)
    c.setFillColor(accent)
    c.roundRect(x, y, 5, height, 2, fill=1, stroke=0)
    c.setFont(FONT_BOLD, title_size)
    c.setFillColor(NAVY)
    c.drawString(x + 18, y + height - 21, title)
    draw_text(
        c, body, x + 18, y + height - 39, width - 31,
        size=8.2, color=MUTED, leading=12,
    )


def draw_pill(c, text, x, y, fill=BLUE_SOFT, color=BLUE_DARK):
    text_w = pdfmetrics.stringWidth(text, FONT_BOLD, 8)
    width = text_w + 18
    c.setFillColor(fill)
    c.roundRect(x, y, width, 18, 9, fill=1, stroke=0)
    c.setFillColor(color)
    c.setFont(FONT_BOLD, 8)
    c.drawString(x + 9, y + 5, text)
    return width


def page_cover(c, version):
    c.setFillColor(PAPER)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(BLUE_SOFT)
    c.circle(PAGE_W - 68, PAGE_H - 40, 170, fill=1, stroke=0)
    c.setFillColor(ORANGE_SOFT)
    c.circle(15, 12, 150, fill=1, stroke=0)

    c.drawImage(
        str(ICON), 65, 326, 110, 110,
        preserveAspectRatio=True, mask="auto",
    )
    c.setFillColor(BLUE)
    c.setFont(FONT_BOLD, 9)
    c.drawString(66, 294, "MICROSOFT EDGE EXTENSION")
    c.setFillColor(NAVY)
    c.setFont(FONT_BOLD, 35)
    c.drawString(62, 242, "TodoMemo")
    c.setFont(FONT_BOLD, 25)
    c.drawString(62, 202, "かんたん操作マニュアル")
    draw_text(
        c,
        "「今すること」を1件だけ見て、迷わず進めるためのTodoメモ。",
        64, 169, 430, size=12, color=MUTED, leading=18,
    )

    draw_card(
        c, 520, 220, 260, 150,
        "このマニュアルでできること",
        "・Edgeへの読み込み\n"
        "・タスクの追加と優先順位変更\n"
        "・Markdownとマルチカーソル\n"
        "・バックアップと安全な復元",
        accent=ORANGE, fill=WHITE, title_size=12,
    )
    draw_pill(c, f"対応バージョン {version}", 65, 110, ORANGE_SOFT, CORAL)
    draw_pill(c, "全10ページ", 202, 110)
    c.setFillColor(MUTED)
    c.setFont(FONT_REGULAR, 8)
    c.drawString(65, 76, "作成日: 2026年7月20日")
    c.showPage()


def page_install(c, page, total, version):
    draw_section_header(
        c, "01  はじめに", "Edgeへ読み込む",
        "TodoMemoは、Microsoft Edgeの「展開して読み込み」から利用できます。",
    )
    left_x = MARGIN
    y = PAGE_H - 132
    y = draw_step(c, 1, "拡張機能ページを開く",
                  "Edgeのアドレスバーに edge://extensions/ と入力します。",
                  left_x, y, 370)
    y = draw_step(c, 2, "開発者モードをオン",
                  "画面左側または上部にある「開発者モード」を有効にします。",
                  left_x, y, 370)
    y = draw_step(c, 3, "TodoMemoフォルダーを選ぶ",
                  "「展開して読み込み」を押し、このTodoMemoフォルダーを選択します。",
                  left_x, y, 370)
    draw_step(c, 4, "ツールバーへ固定",
              "パズル形の拡張機能メニューからTodoMemoをピン留めすると、"
              "いつでも1クリックで開けます。",
              left_x, y, 370)

    x = 455
    c.setFillColor(WHITE)
    c.roundRect(x, 156, 330, 310, 14, fill=1, stroke=0)
    c.setStrokeColor(LINE)
    c.roundRect(x, 156, 330, 310, 14, fill=0, stroke=1)
    c.setFillColor(NAVY)
    c.setFont(FONT_BOLD, 15)
    c.drawString(x + 25, 425, "読み込み後の確認")
    c.drawImage(str(ICON), x + 25, 330, 78, 78, mask="auto")
    draw_text(
        c,
        "暖色のチェックアイコンが表示されれば準備完了です。",
        x + 125, 380, 175, size=10, color=NAVY, leading=16,
    )
    draw_card(
        c, x + 25, 205, 280, 88,
        "データの保存場所",
        "タスクはEdgeの拡張機能用ストレージに保存されます。"
        "別のPCや別プロファイルには自動同期されないため、"
        "定期的にバックアップしてください。",
        accent=ORANGE, fill=ORANGE_SOFT,
    )
    draw_footer(c, page, total, version)
    c.showPage()


def page_popup(c, page, total, version):
    draw_section_header(
        c, "02  基本", "ポップアップで「今すること」に集中",
        "ツールバーのTodoMemoアイコンを押すと、優先順位1番のタスクだけが表示されます。",
    )
    draw_image_contain(
        c, SHOTS / "popup-main.png", 55, 70, 245, 420,
        background=PAPER, padding=4,
    )
    draw_card(
        c, 338, 382, 442, 84,
        "1  バックアップ",
        "下向き矢印のボタンから全件をJSONファイルへ保存します。",
        accent=ORANGE,
    )
    draw_card(
        c, 338, 282, 442, 84,
        "2  その場で編集",
        "鉛筆ボタンでタイトル・内容・期限・分類タグを編集。"
        "変更は入力のたびに自動保存されます。",
    )
    draw_card(
        c, 338, 182, 442, 84,
        "3  整理画面を開く",
        "右端の整理ボタンで、追加・完了・並び替え・タグ管理へ進みます。",
    )
    draw_card(
        c, 338, 82, 442, 84,
        "表示される情報",
        "Markdownで整形された内容、分類タグ、期限、"
        "「あとN日」または「N日超過」が確認できます。",
        accent=GREEN,
    )
    draw_footer(c, page, total, version)
    c.showPage()


def page_organizer(c, page, total, version):
    draw_section_header(
        c, "03  整理", "1番目が「今すること」",
        "整理画面では、暖色で強調された1番目だけがポップアップに表示されます。",
    )
    draw_image_contain(
        c, SHOTS / "organizer-main.png", 42, 67, 758, 397,
        background=PAPER, padding=3,
    )
    draw_pill(c, "ポイント", 55, 478, ORANGE_SOFT, CORAL)
    draw_text(
        c,
        "新しいタスクは2番目へ追加されるため、現在の「今すること」は変わりません。",
        130, 485, 650, size=9.5, color=NAVY,
    )
    draw_footer(c, page, total, version)
    c.showPage()


def page_edit(c, page, total, version):
    draw_section_header(
        c, "04  追加・編集", "タスクを作る",
        "入力項目はタイトル・内容・任意の期限・分類タグです。",
    )
    draw_image_contain(
        c, SHOTS / "task-editor.png", 56, 70, 350, 425,
        background=PAPER, padding=4,
    )
    x = 440
    y = 461
    y = draw_step(c, 1, "タイトル",
                  "必須項目です。短く、次の行動が分かる名前がおすすめです。",
                  x, y, 340)
    y = draw_step(c, 2, "内容",
                  "メモ、手順、リンクを書けます。Markdown記法にも対応しています。",
                  x, y, 340)
    y = draw_step(c, 3, "期限",
                  "任意です。一度設定した期限は「期限を削除」で空に戻せます。",
                  x, y, 340)
    y = draw_step(c, 4, "分類タグ",
                  "仕事・個人・重要など、整理画面で作ったタグを複数選べます。",
                  x, y, 340)
    draw_card(
        c, x, 78, 340, 74,
        "ポップアップ編集は自動保存",
        "「保存済み」と表示されたら保存完了です。整理画面の編集は"
        "「保存する」で確定します。",
        accent=GREEN, fill=colors.HexColor("#F0FAF6"),
    )
    draw_footer(c, page, total, version)
    c.showPage()


def page_markdown(c, page, total, version):
    draw_section_header(
        c, "05  便利な入力", "Markdownとマルチカーソル",
        "長いメモも、キーボード中心で素早く整えられます。",
    )
    draw_image_contain(
        c, SHOTS / "multicursor-editor.png", 460, 68, 330, 428,
        background=PAPER, padding=4,
    )
    c.setFillColor(NAVY)
    c.setFont(FONT_BOLD, 13)
    c.drawString(50, 455, "よく使うMarkdown")
    rows = [
        ("## 見出し", "見出し"),
        ("**重要**", "太字"),
        ("- 項目", "箇条書き"),
        ("- [ ] 確認", "チェックリスト"),
        ("`code`", "コード"),
        ("[名前](https://...)", "リンク"),
    ]
    for index, (syntax, meaning) in enumerate(rows):
        column = index % 2
        row = index // 2
        x = 50 + column * 185
        y = 424 - row * 39
        c.setFillColor(colors.HexColor("#EEF3FC"))
        c.roundRect(x, y - 18, 122, 28, 6, fill=1, stroke=0)
        c.setFillColor(BLUE_DARK)
        c.setFont(FONT_BOLD, 7.5)
        c.drawString(x + 10, y - 8, syntax)
        c.setFillColor(NAVY)
        c.setFont(FONT_REGULAR, 8.5)
        c.drawString(x + 128, y - 8, meaning)

    draw_card(
        c, 50, 95, 370, 84,
        "複数行を同時編集",
        "Alt+クリックでカーソルを追加します。矢印、Home、Endで全カーソルを"
        "同時移動し、Escまたは通常クリックで解除します。",
        accent=ORANGE,
    )
    draw_card(
        c, 50, 190, 370, 74,
        "Tabと改行",
        "Tabでインデント、Shift+Tabで解除。改行すると前の行と同じ"
        "インデントを引き継ぎます。",
    )
    draw_footer(c, page, total, version)
    c.showPage()


def page_tags_complete(c, page, total, version):
    draw_section_header(
        c, "06  分類・完了", "タスクを見分け、終わったら完了へ",
        "タグは自由に追加でき、完了タスクは未完了とは別の場所で管理されます。",
    )
    draw_image_contain(
        c, SHOTS / "tag-section.png", 45, 302, 750, 172,
        background=PAPER, padding=3,
    )
    draw_image_contain(
        c, SHOTS / "completed-section.png", 45, 75, 750, 180,
        background=PAPER, padding=3,
    )
    draw_pill(c, "分類タグ", 55, 484)
    draw_pill(c, "完了", 55, 267, ORANGE_SOFT, CORAL)
    draw_text(
        c,
        "タグ名を入力して「追加」。不要なタグは × で削除できます。",
        140, 490, 620, size=9, color=NAVY,
    )
    draw_text(
        c,
        "カード左の丸を押すと完了へ移動。完了カードのチェックを押すと未完了へ戻せます。",
        115, 273, 650, size=9, color=NAVY,
    )
    draw_footer(c, page, total, version)
    c.showPage()


def page_backup(c, page, total, version):
    draw_section_header(
        c, "07  データ保護", "全件をバックアップする",
        "ポップアップ上部のダウンロードボタンから、現在の全データを保存します。",
    )
    draw_image_contain(
        c, SHOTS / "popup-backup.png", 52, 72, 245, 420,
        background=PAPER, padding=4,
    )
    x = 337
    y = 455
    y = draw_step(c, 1, "ダウンロードボタンを押す",
                  "編集中の場合は、最新内容の自動保存が終わってから作成されます。",
                  x, y, 420)
    y = draw_step(c, 2, "JSONファイルを保管",
                  "ファイル名には年月日と時刻が入ります。例: "
                  "backup-ext_TodoMemo_2026-07-20_1127.json",
                  x, y, 420)
    y = draw_step(c, 3, "定期的に別の場所へコピー",
                  "PC故障や拡張機能削除に備え、クラウドストレージや外部媒体にも"
                  "コピーしておくと安心です。",
                  x, y, 420)
    draw_card(
        c, x, 100, 420, 105,
        "バックアップに含まれるもの",
        "未完了・完了タスク / タイトル / 内容 / 期限 / 優先順位 / "
        "分類タグ / 作成・完了日時 / TodoMemoのバージョン",
        accent=GREEN, fill=colors.HexColor("#F0FAF6"),
    )
    draw_footer(c, page, total, version)
    c.showPage()


def page_restore(c, page, total, version):
    draw_section_header(
        c, "08  データ保護", "バックアップから復元する",
        "整理画面上部の「バックアップから復元」からJSONファイルを選びます。",
    )
    draw_image_contain(
        c, SHOTS / "restore-dialog.png", 55, 164, 730, 324,
        background=PAPER, padding=4,
    )
    draw_card(
        c, 55, 70, 225, 72,
        "1  内容を確認",
        "ファイル名、作成日時、タスク数、タグ数を確認します。",
    )
    draw_card(
        c, 306, 70, 225, 72,
        "2  置換を理解",
        "現在データはバックアップ内容に置き換わります。",
        accent=ORANGE, fill=ORANGE_SOFT,
    )
    draw_card(
        c, 557, 70, 228, 72,
        "3  復元を確定",
        "「この内容で復元」を押します。不正なJSONは拒否されます。",
        accent=GREEN,
    )
    draw_footer(c, page, total, version)
    c.showPage()


def page_reference(c, page, total, version):
    draw_section_header(
        c, "09  クイックリファレンス", "覚えておくと便利",
        "操作に迷ったときは、このページだけ確認すれば大丈夫です。",
    )
    c.setFillColor(NAVY)
    c.setFont(FONT_BOLD, 13)
    c.drawString(48, 455, "キーボード操作")
    shortcuts = [
        ("Tab", "インデントを追加"),
        ("Shift + Tab", "インデントを解除"),
        ("Enter", "同じインデントで改行"),
        ("Alt + クリック", "カーソルを追加"),
        ("矢印 / Home / End", "全カーソルを同時移動"),
        ("Esc / 通常クリック", "マルチカーソルを解除"),
    ]
    y = 425
    for key, action in shortcuts:
        c.setFillColor(WHITE)
        c.roundRect(48, y - 19, 355, 30, 7, fill=1, stroke=0)
        c.setStrokeColor(LINE)
        c.roundRect(48, y - 19, 355, 30, 7, fill=0, stroke=1)
        c.setFillColor(BLUE_DARK)
        c.setFont(FONT_BOLD, 8.5)
        c.drawString(60, y - 8, key)
        c.setFillColor(NAVY)
        c.setFont(FONT_REGULAR, 8.5)
        c.drawString(190, y - 8, action)
        y -= 39

    c.setFillColor(NAVY)
    c.setFont(FONT_BOLD, 13)
    c.drawString(448, 455, "困ったとき")
    draw_card(
        c, 448, 348, 340, 82,
        "変更が画面に反映されない",
        "edge://extensions/ を開き、TodoMemoの更新ボタンを押してください。",
    )
    draw_card(
        c, 448, 248, 340, 82,
        "ポップアップに何も出ない",
        "整理画面を開いて新しいタスクを追加します。未完了の1番目が表示されます。",
        accent=ORANGE,
    )
    draw_card(
        c, 448, 148, 340, 82,
        "復元ファイルを選べない",
        "TodoMemoのバックアップボタンから作成した .json ファイルを選んでください。",
        accent=RED,
    )
    draw_card(
        c, 448, 58, 340, 72,
        "おすすめの運用",
        "大きな変更前と週1回を目安にバックアップすると安心です。",
        accent=GREEN, fill=colors.HexColor("#F0FAF6"),
    )
    draw_footer(c, page, total, version)
    c.showPage()


def build_pdf():
    register_fonts()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    version = json.loads(MANIFEST.read_text(encoding="utf-8"))["version"]
    total = 10

    c = canvas.Canvas(str(OUTPUT), pagesize=(PAGE_W, PAGE_H))
    c.setTitle("TodoMemo かんたん操作マニュアル")
    c.setAuthor("TodoMemo")
    c.setSubject("Microsoft Edge拡張機能 TodoMemo の操作方法")

    page_cover(c, version)
    page_install(c, 2, total, version)
    page_popup(c, 3, total, version)
    page_organizer(c, 4, total, version)
    page_edit(c, 5, total, version)
    page_markdown(c, 6, total, version)
    page_tags_complete(c, 7, total, version)
    page_backup(c, 8, total, version)
    page_restore(c, 9, total, version)
    page_reference(c, 10, total, version)
    c.save()
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
