#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate portfolio/portfolio.pdf for choehanmin.github.io.

To add a new activity/spec entry:
  1. Add a row to ACTIVITIES (or VOLUNTEER) below, in chronological order.
  2. Bump the "21+" number in STATS / STRENGTHS text if the activity count changed.
  3. Run:  pip install pymupdf fonttools  (if not already installed)
           python3 scripts/generate_portfolio_pdf.py
  4. Render scripts/portfolio_generated.pdf to PNG and eyeball it (pymupdf
     Page.get_pixmap) before copying it over the real file:
           cp scripts/portfolio_generated.pdf portfolio/portfolio.pdf

Fonts: NanumGothic (Regular/Bold) TTF files live in scripts/fonts/. This
script auto-subsets them (via fontTools) down to only the glyphs the
current content actually uses, so the output PDF stays small. If fontTools
isn't installed, it falls back to embedding the full fonts (much bigger
file, still renders correctly).

Colors/layout mirror the navy (#1F2A44) / gold (#B8862F) theme used in
portfolio/index.html.
"""
import os
import sys
import tempfile
from pathlib import Path

import pymupdf

SCRIPT_DIR = Path(__file__).resolve().parent
FONT_DIR = SCRIPT_DIR / "fonts"
FULL_REG_PATH = FONT_DIR / "NanumGothic-Regular.ttf"
FULL_BOLD_PATH = FONT_DIR / "NanumGothic-Bold.ttf"

# Reassigned by setup_fonts() to point at subsetted copies before build() runs.
REG_PATH = str(FULL_REG_PATH)
BOLD_PATH = str(FULL_BOLD_PATH)
OUT_PATH = str(SCRIPT_DIR / "portfolio_generated.pdf")

PAGE_W, PAGE_H = 595.3, 841.9
MARGIN_L, MARGIN_R, MARGIN_T, MARGIN_B = 50, 50, 50, 46
CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R

NAVY = (31/255, 42/255, 68/255)
GOLD = (184/255, 134/255, 47/255)
GOLD_TEXT = (200/255, 148/255, 56/255)
BLUE = (46/255, 90/255, 172/255)
INK = (20/255, 23/255, 42/255)
MUTED = (107/255, 111/255, 123/255)
LINE_SOFT = (226/255, 228/255, 234/255)
CELL_BG = (242/255, 242/255, 242/255)
WHITE = (1, 1, 1)

# FONT_REG / FONT_BOLD are (re)created by setup_fonts() once the subsetted
# font files exist; placeholders here so the names exist at import time.
FONT_REG = None
FONT_BOLD = None


def wrap(text, font_obj, size, max_width):
    words = text.split(' ')
    lines = []
    cur = ''
    for w in words:
        trial = (cur + ' ' + w) if cur else w
        if font_obj.text_length(trial, fontsize=size) <= max_width:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            if font_obj.text_length(w, fontsize=size) <= max_width:
                cur = w
            else:
                sub = ''
                for ch in w:
                    t2 = sub + ch
                    if font_obj.text_length(t2, fontsize=size) <= max_width:
                        sub = t2
                    else:
                        if sub:
                            lines.append(sub)
                        sub = ch
                cur = sub
    if cur:
        lines.append(cur)
    return lines or ['']


class Builder:
    def __init__(self):
        self.doc = pymupdf.open()
        self.page = None
        self.y = 0
        self.new_page()

    def new_page(self):
        self.page = self.doc.new_page(width=PAGE_W, height=PAGE_H)
        self.page.insert_font(fontname='reg', fontfile=REG_PATH)
        self.page.insert_font(fontname='bold', fontfile=BOLD_PATH)
        self.y = MARGIN_T

    def ensure(self, h):
        if self.y + h > PAGE_H - MARGIN_B:
            self.new_page()

    def text(self, x, y, s, size, bold=False, color=INK):
        self.page.insert_text((x, y), s, fontsize=size, fontname='bold' if bold else 'reg', color=color)

    def rect(self, x0, y0, x1, y1, fill=None, stroke=None, width=1):
        r = pymupdf.Rect(x0, y0, x1, y1)
        self.page.draw_rect(r, color=stroke, fill=fill, width=width)

    def line(self, x0, y0, x1, y1, color, width=0.75):
        self.page.draw_line((x0, y0), (x1, y1), color=color, width=width)

    def gap(self, h):
        self.y += h

    def heading_name(self, name, subtitle):
        self.ensure(70)
        self.text(MARGIN_L, self.y + 26, name, 24, bold=True, color=NAVY)
        self.y += 34
        self.text(MARGIN_L, self.y + 11, subtitle, 10.5, color=MUTED)
        self.y += 22

    def contact_line(self, s):
        self.ensure(16)
        self.text(MARGIN_L, self.y + 9, s, 9.5, color=MUTED)
        self.y += 15

    def stat_strip(self, stats):
        self.ensure(58)
        box_h = 50
        gap = 2
        n = len(stats)
        box_w = (CONTENT_W - gap * (n - 1)) / n
        x = MARGIN_L
        for num, label in stats:
            self.rect(x, self.y, x + box_w, self.y + box_h, fill=NAVY, stroke=None)
            cx = x + box_w / 2
            nw = FONT_BOLD.text_length(num, fontsize=15)
            self.text(cx - nw / 2, self.y + 22, num, 15, bold=True, color=WHITE)
            lw = FONT_REG.text_length(label, fontsize=8)
            self.text(cx - lw / 2, self.y + 35, label, 8, color=GOLD_TEXT)
            x += box_w + gap
        self.y += box_h + 26

    def section_header(self, tag, title):
        self.ensure(34)
        tag_w = FONT_BOLD.text_length(tag, fontsize=8.5) + 14
        self.rect(MARGIN_L, self.y, MARGIN_L + tag_w, self.y + 15, fill=GOLD, stroke=None)
        self.text(MARGIN_L + 7, self.y + 11, tag, 8.5, bold=True, color=NAVY)
        self.text(MARGIN_L + tag_w + 10, self.y + 12.5, title, 13.5, bold=True, color=NAVY)
        self.y += 15
        self.line(MARGIN_L, self.y + 8, MARGIN_L + CONTENT_W, self.y + 8, LINE_SOFT, 1)
        self.y += 22

    def sub_lead(self, text, size=10.5, color=BLUE):
        lines = wrap(text, FONT_BOLD, size, CONTENT_W)
        self.ensure(len(lines) * (size * 1.5) + 4)
        for ln in lines:
            self.text(MARGIN_L, self.y + size, ln, size, bold=True, color=color)
            self.y += size * 1.5
        self.y += 6

    def paragraph(self, text, size=9.7, color=INK, line_gap=1.55, space_after=14, width=None, x=None):
        x = MARGIN_L if x is None else x
        width = CONTENT_W if width is None else width
        lines = wrap(text, FONT_REG, size, width)
        for ln in lines:
            self.ensure(size * line_gap)
            self.text(x, self.y + size * 0.95, ln, size, color=color)
            self.y += size * line_gap
        self.y += space_after

    def strength(self, title, body):
        self.ensure(20)
        self.text(MARGIN_L, self.y + 11, title, 11, bold=True, color=NAVY)
        self.y += 18
        self.paragraph(body, size=9.5, color=MUTED, space_after=16)

    def table(self, headers, col_widths, rows):
        x0 = MARGIN_L
        col_x = [x0]
        for w in col_widths:
            col_x.append(col_x[-1] + w)
        header_h = 16.5
        self.ensure(header_h + 30)
        self.rect(x0, self.y, x0 + sum(col_widths), self.y + header_h, fill=NAVY, stroke=None)
        for i, h in enumerate(headers):
            self.text(col_x[i] + 8, self.y + 11.5, h, 9, bold=True, color=WHITE)
        self.y += header_h

        pad_x, pad_y, size, lg = 8, 8, 9, 1.42
        for period, title, desc in rows:
            p_lines = wrap(period, FONT_REG, size, col_widths[0] - 2 * pad_x)
            t_lines = wrap(title, FONT_BOLD, size, col_widths[1] - 2 * pad_x)
            d_lines = wrap(desc, FONT_REG, size, col_widths[2] - 2 * pad_x)
            n_lines = max(len(p_lines), len(t_lines), len(d_lines))
            row_h = n_lines * size * lg + 2 * pad_y

            # page-break: if header row already drawn but row doesn't fit, start new page and redraw header
            if self.y + row_h > PAGE_H - MARGIN_B:
                self.new_page()
                self.rect(x0, self.y, x0 + sum(col_widths), self.y + header_h, fill=NAVY, stroke=None)
                for i, h in enumerate(headers):
                    self.text(col_x[i] + 8, self.y + 11.5, h, 9, bold=True, color=WHITE)
                self.y += header_h

            top = self.y
            self.rect(col_x[0], top, col_x[1], top + row_h, fill=CELL_BG, stroke=None)
            yy = top + pad_y
            for ln in p_lines:
                self.text(col_x[0] + pad_x, yy + size * 0.9, ln, size, color=INK)
                yy += size * lg
            yy = top + pad_y
            for ln in t_lines:
                self.text(col_x[1] + pad_x, yy + size * 0.9, ln, size, bold=True, color=NAVY)
                yy += size * lg
            yy = top + pad_y
            for ln in d_lines:
                self.text(col_x[2] + pad_x, yy + size * 0.9, ln, size, color=MUTED)
                yy += size * lg
            self.y += row_h
            self.line(x0, self.y, x0 + sum(col_widths), self.y, LINE_SOFT, 1)
        self.y += 20

    def project(self, title, meta, bullets):
        self.ensure(24)
        self.text(MARGIN_L, self.y + 12, title, 11.5, bold=True, color=NAVY)
        self.y += 17
        self.paragraph(meta, size=9, color=MUTED, space_after=8)
        for b in bullets:
            lines = wrap(b, FONT_REG, 9.3, CONTENT_W - 14)
            self.ensure(len(lines) * 9.3 * 1.5 + 2)
            self.text(MARGIN_L, self.y + 9.3 * 0.9, '•', 9.3, color=GOLD)
            for i, ln in enumerate(lines):
                self.text(MARGIN_L + 14, self.y + 9.3 * 0.9, ln, 9.3, color=INK)
                self.y += 9.3 * 1.5
        self.y += 10

    def award_table(self, rows):
        col_widths = [95, CONTENT_W - 95]
        x0 = MARGIN_L
        header_h = 16.5
        self.ensure(header_h + 24)
        self.rect(x0, self.y, x0 + CONTENT_W, self.y + header_h, fill=NAVY, stroke=None)
        self.text(x0 + 8, self.y + 11.5, '일자', 9, bold=True, color=WHITE)
        self.text(x0 + col_widths[0] + 8, self.y + 11.5, '내용', 9, bold=True, color=WHITE)
        self.y += header_h
        size, lg, pad_x, pad_y = 9, 1.42, 8, 7
        for date, desc in rows:
            d_lines = wrap(desc, FONT_REG, size, col_widths[1] - 2 * pad_x)
            row_h = len(d_lines) * size * lg + 2 * pad_y
            if self.y + row_h > PAGE_H - MARGIN_B:
                self.new_page()
                self.rect(x0, self.y, x0 + CONTENT_W, self.y + header_h, fill=NAVY, stroke=None)
                self.text(x0 + 8, self.y + 11.5, '일자', 9, bold=True, color=WHITE)
                self.text(x0 + col_widths[0] + 8, self.y + 11.5, '내용', 9, bold=True, color=WHITE)
                self.y += header_h
            top = self.y
            self.rect(x0, top, x0 + col_widths[0], top + row_h, fill=CELL_BG, stroke=None)
            self.text(x0 + pad_x, top + pad_y + size * 0.9, date, size, color=INK)
            yy = top + pad_y
            for ln in d_lines:
                self.text(x0 + col_widths[0] + pad_x, yy + size * 0.9, ln, size, color=MUTED)
                yy += size * lg
            self.y += row_h
            self.line(x0, self.y, x0 + CONTENT_W, self.y, LINE_SOFT, 1)
        self.y += 20

    def save(self):
        self.doc.save(OUT_PATH, garbage=4, deflate=True)


# ---------------------------------------------------------------------------
# Content
# ---------------------------------------------------------------------------

STATS = [("7종", "게임 개발·출시"), ("24+", "경력 및 대외활동"), ("6기", "갤캠스 방장"), ("Native", "수준 영어 구사")]

CONTACT_LINES = [
    "Naver Blog   blog.naver.com/choehanmin",
    "이메일   hufshanmin@gmail.com      전화번호   010-3250-8620",
    "GitHub   github.com/ChoeHanMin      Instagram   @choihanmin_, @choehanmin, @dae.hanmin.guk",
]

INTRO = ("컴퓨터공학을 전공하며 개발과 서비스 기획을 함께 경험해온 학생입니다. Python 교육조교와 게임 개발 동아리 "
         "활동으로 기술 역량을 다지고, 삼성 갤럭시 서포터즈와 하나 소셜벤처 활동에서 기획부터 실행까지 프로젝트를 직접 "
         "이끌며 성과를 만들어왔습니다. 개발자 혹은 서비스 기획자로서 팀에 실질적인 결과물을 안겨줄 수 있는 사람이 되는 "
         "것을 목표로 하고 있습니다.")

STRENGTHS = [
    ("기획부터 배포까지, 끝까지 완수하는 실행력",
     "인디 게임 스튜디오 'Soodal Games'를 운영하며 7종의 게임을 기획·개발해 Google Play Store와 Steam에 정식 "
     "출시했습니다. TutoGen 프로젝트에서는 시장 조사부터 MVP 설계, 데모 발표 자료 제작까지 전 과정을 직접 담당했고, "
     "갤럭시 캠퍼스 커뮤니티 활성화 전략에서는 초기 와이어프레임 단계부터 최종 16페이지 발표 자료가 완성되기까지 "
     "여러 차례 수정을 거치며 완성도를 끌어올렸습니다. 아이디어에서 멈추지 않고 눈에 보이는 결과물로 만들어내는 "
     "실행력은 여러 기업이 신뢰할 수 있는 협업 파트너로 평가하는 이유입니다."),
    ("24건 이상의 실전 경험에서 검증된 리더십과 소통력",
     "삼성 갤럭시 대학생 서포터즈 활동에서 7인 팀의 방장이자 발표자로 우수방장으로 인정받았고, 한국외국어대학교 "
     "컴퓨팅사고 수업의 교육조교로 다양한 배경의 학생들과 소통해왔습니다. 지금까지 24건 이상의 대내외 활동에서 "
     "리더 혹은 핵심 실무자로 참여하며, 상대의 이야기를 먼저 듣고 의견을 조율하는 태도로 협업을 이끌어왔습니다. "
     "스타트업 특유의 빠른 실행력과 대기업 프로그램의 체계적인 협업 프로세스를 모두 경험한 만큼, 어떤 조직 문화에도 "
     "빠르게 적응하는 인재로 평가받고 있습니다."),
    ("기술과 기획을 아우르는 균형 감각",
     "Python, C++, JavaScript, HTML/CSS 등 개발 기초 역량과 MediaPipe·CLIP·FAISS·YOLOv8 등 AI 파이프라인 실습 "
     "경험을 함께 갖추고 있습니다. 하나 소셜벤처 유니버시티에서는 창업 아이템 기획부터 비즈니스모델 캔버스 작성, "
     "MVP 개발까지 전 과정을, TutoGen과 갤럭시 캠퍼스 프로젝트에서는 사용자 관점의 서비스 기획과 발표까지 직접 "
     "수행했습니다. 기술을 이해하는 기획자이자 기획을 이해하는 개발자로서, 다양한 산업과 조직에서 곧바로 투입 "
     "가능한 실무형 인재를 목표로 하고 있습니다."),
    ("Native 수준의 영어 구사 능력",
     "캐나다 2년, 남아프리카공화국 6개월 거주 경험을 바탕으로 영어를 Native 수준으로 구사합니다. GTKEC Academy "
     "에서 영어 강사로 활동했고, TOEIC 810점을 취득했으며, LiNK English Language Program(LELP)에서는 북한 출신 "
     "청년을 대상으로 영어 회화를 1:1로 코칭하는 English Buddy로 활동하고 있습니다. 언어 장벽 없이 해외 파트너 및 "
     "글로벌 팀과 즉시 협업할 수 있는 역량을 갖추고 있습니다."),
]

PAGE2_LEAD = "많은 기업들과 여러 단체 및 협회들이 찾는 인재"
PAGE2_BODY = ("하나금융그룹, 삼성전자, LG CNS 등 대기업 서포터즈부터 시대에듀·코드하나·멈블 등 스타트업, "
              "한국특수판매공제조합·굿네이버스·LiNK와 같은 협회 및 국제 NGO까지, 업종과 규모를 가리지 않는 20건이 넘는 "
              "조직에서 함께 일해왔습니다. 금융, 교육, IT, 유통, 비영리 등 서로 다른 산업의 조직들이 공통적으로 저를 찾는 "
              "이유는 어떤 환경에서도 빠르게 적응해 결과를 만들어내는 실행력 때문입니다. 다양한 조직 문화를 두루 경험한 "
              "만큼, 새로운 팀에 합류해도 빠르게 녹아들어 즉시 기여할 수 있습니다.")

ACTIVITIES = [
    ("2026.09.09 ~ 2026.10.07", "해커스 블로그 리포터 해블리 17기 서포터즈",
     "해커스 강의·교재를 학습하며 주 1회(총 4회) 학습 경험과 노하우를 담은 후기성 포스팅을 개인 블로그에 연재, 활동을 담은 네이버 클립 영상 제작 및 학습 인증·후기 트위터 게시글 발행"),
    ("2026.09 ~ 2026.12", "LG CNS AI Genius 서포터즈 16기",
     "AI SW 체험 수업 현장 운영 지원 및 학생 활동 보조, SNS 콘텐츠·활동 영상 제작 및 홍보, 발대식·해단식 등 LG 공식 일정 참여"),
    ("2026.09 ~ 2026.11", "서울 디지털 성범죄 안심 서포터즈",
     "디지털 성범죄 예방·근절을 위한 온라인 캠페인 기획 및 홍보, 시민 인식 개선 콘텐츠 제작·확산"),
    ("2026.09.01 ~ 2026.11.28", "LiNK English Language Program(LELP) English Buddy",
     "영어 실력 향상을 위해 영어 회화를 1:1로 코칭"),
    ("2026.09.01 ~ 2026.12.19", "한국중소벤처기업유통원 TOPS 서포터즈",
     "소상공인 성장 지원 사업 TOPS를 알리는 홍보 서포터즈로 활동, SNS 홍보 콘텐츠 기획·제작·게시 및 프로그램 홍보 아이디어 제안"),
    ("2026.08.31 ~ 2026.10.25", "멈블 앰버서더 5기",
     "대학생 커뮤니티 메신저 '멈블'을 직접 경험하며 서비스 기능·가치를 알리는 대학생 앰버서더 프로그램, 콘텐츠 제작 및 서비스 아이디어 제안"),
    ("2026.08.31 ~ 2026.09.29", "굿네이버스 경기남부사업본부 AI 캠페인 크리에이터 2기",
     "ChatGPT, Gemini, Claude, Zenspark, Vrew 등 생성형 AI 툴을 직접 활용해 캠페인 기획안·카드뉴스·숏폼 영상 3종 포트폴리오를 완성하는 실전 프로젝트, 아이디어 구체화부터 콘텐츠 제작까지 전 과정 수행"),
    ("2026.08.24 ~ 2026.10.30", "한국특수판매공제조합 K-애디터즈 서포터즈 8기",
     "직접판매산업 소개 및 2026 직접판매세계대회 홍보 콘텐츠 제작, 대회 현장 취재·인터뷰 및 조합 홍보부스 운영 지원, 활동 종료 후 결과보고서 작성"),
    ("2026.08.11 ~ 2026.09.06", "시대에듀 에듀메이트 서포터즈 2기",
     "블로그·SNS를 활용한 시대에듀 콘텐츠 제작, AI 뇌각인 시스템 체험 및 홍보"),
    ("2026.08 ~ 2026.11", "인텔 서포터즈",
     "발대식 참여 및 다나와 아카데미 인텔 부스 방문·제품 체험 후기 콘텐츠 제작, 인텔 제품 실사용 기반 주차별 미션 콘텐츠 기획·제작"),
    ("2026.08 ~ 2027.01", "코드하나 코더스 서포터즈",
     "초등학교 6학년 SW·AI 교육 진행, 교육 기획 및 SNS 릴스 제작, 컴퓨팅 사고력 문제 제작, 공식 행사 및 네트워킹 참여"),
    ("2026.08", "2026 농촌 홍보",
     "경기 가평군 설악면 초롱이둥지마을 교육 연구 및 문화 홍보 담당으로 참여, 마을 홍보 릴스 제작"),
    ("2026.08 ~ 2026.10", "2030 신메뉴 리서치 & 모니터링 서포터즈",
     "매장 방문 신메뉴 시식 및 매장 환경·서비스 모니터링, 소비자 관점의 평가 설문 작성·제출"),
    ("2026.07 ~ 2026.08", "하나 소셜벤처 유니버시티 5기",
     "팀 에이인베스트(A-Invest) 소속으로 소셜벤처 경진대회 참가, AI 기반 투자 지원 서비스(TutoGen) 개발"),
    ("2026.06 ~ 2028.03", "죽전 다우디지털스퀘어 AI 육성센터",
     "AI 분야 실무 역량 강화를 위한 육성 프로그램 참여"),
    ("2026.05", "AI경진대회 'Scene Search' 참여",
     "비전 기반 사진 검색 시스템 개발 팀원 (자세·구도 분석, NLP, 스케치 입력 기반 검색)"),
    ("2026.05.01 ~ 2026.05.31", "모아진(Moazine) 서포터즈",
     "국내 잡지를 해외에 알리는 홍보 카드뉴스 기획·제작 및 SNS 채널 홍보 담당"),
    ("2026.03 ~ 2026.12", "삼성 갤럭시 대학생 서포터즈 (갤대서 6기)",
     "갤럭시 캠퍼스 스토어 스마트폰 커뮤니티 콘텐츠 기획 및 운영"),
    ("2026.03 ~ 2026.06", "삼성 갤럭시 캠퍼스 스토어 스마트폰 커뮤니티 방장",
     "커뮤니티 채널 운영 총괄, 팀 프로젝트(UX/UI 개편, 게이미피케이션, 리워드 체계 기획) 리드"),
    ("2026.03 ~ 2026.06", "한국외국어대학교 컴퓨팅 사고 교육조교(TA)",
     "Python 기반 프로그래밍 수업 조교, 실습 자료 및 강의 PPT 제작"),
    ("2026.03", "연구개발특구 딥테크 기업 미국 공공조달 진출 전략 세미나 진행",
     "딥테크 기업 대상 미국 공공조달 시장 진출 전략 세미나 발표"),
    ("2022.01 ~ 2023.10", "공군 무선통신체계정비",
     "기지 내 및 작전 지역의 무선통신 장비와 항행안전무선시설을 점검·정비하는 임무 수행"),
    ("2020.03 ~ 현재", "AJ 게임 개발 동아리", "게임 개발 프로젝트 기획 및 제작 참여"),
    ("2020.03 ~ 2020.12", "C++ 스터디그룹", "C++ 언어 기초 및 활용을 위한 자율 스터디 운영"),
]

VOLUNTEER = [
    ("2026.09.01 ~ 2026.11.28", "LiNK 국제 NGO 영어회화 프로그램 버디",
     "북한 출신 청년의 영어 실력 향상과 변화의 주체로 성장하는 것을 지원, 영어 회화 1:1 코칭"),
    ("2026.08", "농촌일손여행 대학생 봉사활동", "농촌 지역 일손 지원을 위한 대학생 봉사활동 참여"),
    ("2021.02 ~ 2021.08", "GTKEC(Getting To Know English Center) 학원 Level 1 강사",
     "남아프리카공화국으로 이민 온 이집트·나이지리아 등 학생들의 영어 실력 향상을 위해 코칭"),
    ("2017.05", "연탄 배달 봉사", "저소득 가구 대상 연탄 나눔 봉사활동 참여"),
    ("2015.03 ~ 2015.09", "발달장애 아동 대상 봉사활동", "발달장애 아동을 대상으로 정기적인 돌봄 및 활동 지원 봉사 수행"),
]

PROJECTS = [
    ("하나 소셜벤처 유니버시티 5기",
     "하나금융그룹 주관 소셜벤처 육성 프로그램 참가 (팀 에이인베스트(A-Invest), 2026.07 ~ 2026.08)",
     ["아이디어 구상, 비즈니스모델 캔버스 작성, MVP 개발, 피치덱 제작, 데모 발표까지 창업의 전 과정을 직접 수행하며 기획·개발·창업 전반의 실무 프로세스를 학습",
      "투자 초보자를 위한 AI 서비스 TutoGen을 팀과 함께 기획·개발하며, 아이디어를 실제 제품으로 구체화하는 경험을 축적"]),
    ("TutoGen — AI 기반 실시간 화면 가이드 크롬 익스텐션",
     "하나 소셜벤처 유니버시티 5기 경진대회 출품작 (팀 에이인베스트(A-Invest), 2026.07 ~ 2026.08)",
     ["국내 증권 투자 초보자를 대상으로, 현재 보고 있는 화면을 인식해 맞춤형 가이드를 실시간으로 제공하는 크롬 익스텐션",
      "피치덱, MVP 기획서, 데모용 발표 자료(PPT) 제작을 포함해 서비스 기획부터 발표까지 전 과정 담당",
      "투자 진입장벽을 낮추는 UX를 목표로 화면별 온보딩 시나리오 설계"]),
    ("Scene Search (씬 서치) — 비전 기반 사진 검색 시스템",
     "AI경진대회 참여 프로젝트 (팀장 김가연, 2026.05)",
     ["자세(pose) 분석, 구도 분석, 자연어 처리, 스케치 입력을 결합한 멀티모달 사진 검색 시스템 개발",
      "MediaPipe, CLIP, FAISS, YOLOv8 등을 활용한 비전·검색 파이프라인 구축에 참여"]),
    ("갤럭시 캠퍼스 스토어 커뮤니티 활성화 전략",
     "삼성 갤럭시 대학생 서포터즈 6기 팀 프로젝트 (팀 칠공주파, 7인, 방장 겸 발표자)",
     ["UX/UI 리뉴얼, 게이미피케이션, 카테고리 재구성, SEO 전략, 등급별 리워드 체계를 포함한 종합 활성화 전략 수립",
      "초기 와이어프레임부터 최종 16페이지 발표 자료까지 다수 버전을 거쳐 완성, 발표자 및 콘텐츠 총괄로 참여"]),
    ("모아진(Moazine) 매거진 글로벌 홍보 카드뉴스",
     "모아진 서포터즈 활동 (2026.05.01 ~ 2026.05.31, 기획·제작·홍보 전 과정 담당)",
     ["국내 잡지 콘텐츠를 해외 독자에게 소개한다는 목표 아래, 카드뉴스 시리즈의 주제 선정과 메시지 흐름을 직접 기획",
      "한 장에 하나의 메시지만 담는 원칙으로 카피·레이아웃·이미지를 구성하고, 가독성과 시선 흐름을 고려해 카드 순서와 정보량을 조정",
      "완성한 카드뉴스를 SNS 채널에 게시하고 해시태그·업로드 시점 등 노출 전략을 함께 운영하며 기획부터 홍보까지 전 과정을 완결"]),
    ("최한민에게 요청하기 — 개인 웹 요청 서비스",
     "개인 프로젝트, 바닐라 JavaScript 기반 단일 페이지 웹 애플리케이션",
     ["EmailJS, Firebase Firestore, Google Apps Script를 연동해 요청 접수 및 로깅이 가능한 웹 서비스를 직접 기획·개발",
      "애니메이션 SVG 캐릭터, 다크·라이트 모드, 게이미피케이션 요소 등 사용자 경험을 높이는 기능을 다수 구현",
      "GitHub Pages를 통해 배포, 프론트엔드부터 백엔드 연동까지 전 과정을 단독으로 개발"]),
    ("Tappy Friends — 캔버스 기반 아케이드 게임",
     "개인 프로젝트, JavaScript(Canvas 2D) 기반 웹 게임",
     ["Flappy Bird 스타일의 캔버스 게임으로, 4종 캐릭터와 언락 가능한 히든 캐릭터를 포함한 게임 로직을 직접 설계",
      "충돌 처리, 애니메이션, 점수 시스템 등 게임 전반의 로직을 순수 JavaScript로 구현",
      "GitHub Pages에 배포하여 서비스"]),
    ("모바일 게임 7종 개발 및 Google Play Store·Steam 출시",
     "개인 인디 게임 스튜디오 'Soodal Games (Choi Hanmin)' 운영, Google Play Store 및 Steam 출시",
     ["미니법정(Mini Court): 한국 법정을 소재로 한 픽셀아트 시뮬레이션 게임. Canvas 2D와 Web Audio API를 활용해 단일 HTML 파일로 제작 후 PWA/TWA 형태로 패키징하여 Google Play와 Steam에 동시 출시",
      "Stealth Ops, 자리 사냥(Seat Hunter), Time Heist 24, 미로 탈출(Maze Escape), Color Debt, Stress Smash: 스텔스·예측·전략·퍼즐 등 서로 다른 장르로 추가 개발해 Google Play에 함께 출시한 모바일 게임 6종",
      "기획·개발·아트·사운드부터 웹 게임의 모바일 패키징, 스토어 등록, 마케팅까지 게임당 전 과정을 단독으로 수행"]),
]

AWARDS = [
    ("2026.08.20", "하나금융그룹 '2026 하나 소셜벤처 유니버시티 창업 심화 교육' 수료"),
    ("2026.08.14", "농림축산식품부·한국농어촌공사 공동 주관 농촌 프로그램 전체 2위 수료, 수료증 수여"),
    ("2026.08.13", "고용노동부 주관 '청년 일경험 지원사업' 수료"),
    ("2026.07.08", "AI 상상그라운드 상상클래스 (KT&G 주최, NSI 주관) 수료"),
    ("2026.06.09", "한국외국어대학교 여행 공모전 은상 수상"),
    ("2026.03", "한국외국어대학교 외국어연수평가원 영어특별과정 수료 (99.00/100)"),
    ("2023.07", "TOEIC 810점 취득"),
]

TECHSTACK = [
    "프로그래밍: Python, C++, C, JavaScript, HTML, CSS",
    "AI/ML: MediaPipe, CLIP, FAISS, YOLOv8 등 비전·검색 파이프라인 경험",
    "도구 및 협업: PPT/문서 기획, 콘텐츠 제작(카드뉴스, 캡션, 이미지 생성), GitHub",
    "디자인/영상: Figma, Canva, CapCut, Illustrator, Photoshop을 활용한 UI 목업, 카드뉴스, 영상 콘텐츠 제작",
]


def build():
    b = Builder()

    # ---- Page 1: Cover ----
    b.heading_name("최한민 (Choi Hanmin)", "한국외국어대학교 컴퓨터공학과(CES) | 학번 202003621")
    for ln in CONTACT_LINES:
        b.contact_line(ln)
    b.gap(14)
    b.stat_strip(STATS)

    b.section_header("ABOUT", "한 줄 소개")
    b.paragraph(INTRO, space_after=20)

    b.section_header("STRENGTHS", "핵심 강점")
    for title, body in STRENGTHS:
        b.strength(title, body)

    # ---- Page 2+: orgs / activities / volunteer ----
    b.sub_lead(PAGE2_LEAD)
    b.paragraph(PAGE2_BODY, space_after=20)

    b.section_header("CAREER", "경력 및 대외활동")
    b.table(("기간", "활동명", "내용"), [110, 130, 250], ACTIVITIES)

    b.section_header("VOLUNTEER", "봉사활동")
    b.table(("기간", "활동명", "내용"), [110, 130, 250], VOLUNTEER)

    b.section_header("PROJECTS", "주요 프로젝트")
    for title, meta, bullets in PROJECTS:
        b.project(title, meta, bullets)

    b.section_header("AWARDS", "수상 및 수료")
    b.award_table(AWARDS)

    b.section_header("STACK", "기술 스택")
    for item in TECHSTACK:
        lines = wrap(item, FONT_REG, 9.5, CONTENT_W - 14)
        b.ensure(len(lines) * 9.5 * 1.55 + 2)
        b.text(MARGIN_L, b.y + 9.5 * 0.9, '•', 9.5, color=GOLD)
        for ln in lines:
            b.text(MARGIN_L + 14, b.y + 9.5 * 0.9, ln, 9.5, color=INK)
            b.y += 9.5 * 1.55
        b.y += 4

    b.save()
    print("saved:", OUT_PATH, "pages:", len(b.doc))


def _collect_used_chars():
    """Gather every character referenced by the document content below,
    so the fonts can be subsetted to just what's actually needed."""
    mod = sys.modules[__name__]
    chars = set()

    def add(x):
        if isinstance(x, str):
            chars.update(x)
        elif isinstance(x, (list, tuple)):
            for item in x:
                add(item)

    for name in ("STATS", "CONTACT_LINES", "INTRO", "STRENGTHS", "PAGE2_LEAD",
                 "PAGE2_BODY", "ACTIVITIES", "VOLUNTEER", "PROJECTS", "AWARDS",
                 "TECHSTACK"):
        add(getattr(mod, name, None))

    # Static UI chrome not in the content lists above (headers, labels, name).
    chars.update("최한민 (Choi Hanmin) 한국외국어대학교 컴퓨터공학과(CES) | 학번 202003621")
    chars.update("ABOUTSTRENGTHSCAREERVOLUNTEERPROJECTSAWARDSSTACK")
    chars.update("한 줄 소개 핵심 강점 경력 및 대외활동 봉사활동 주요 프로젝트 수상 및 수료 기술 스택")
    chars.update("기간 활동명 내용 일자")
    chars.update("0123456789.,()·-~+/:;•→↗ ")
    return chars


def setup_fonts(tmp_dir):
    """Subset the NanumGothic fonts down to used glyphs (keeps the PDF
    small) and point REG_PATH/BOLD_PATH/FONT_REG/FONT_BOLD at the result.
    Falls back to the full fonts if fontTools isn't installed."""
    global REG_PATH, BOLD_PATH, FONT_REG, FONT_BOLD
    chars = _collect_used_chars()
    try:
        from fontTools import subset as ft_subset

        text = "".join(sorted(chars))
        reg_out = os.path.join(tmp_dir, "Sub-Regular.ttf")
        bold_out = os.path.join(tmp_dir, "Sub-Bold.ttf")
        for src, out in ((FULL_REG_PATH, reg_out), (FULL_BOLD_PATH, bold_out)):
            ft_subset.main([str(src), f"--text={text}", f"--output-file={out}"])
        REG_PATH, BOLD_PATH = reg_out, bold_out
    except Exception as exc:  # pragma: no cover - fallback path
        print(f"[warn] font subsetting skipped ({exc}); embedding full fonts")
        REG_PATH, BOLD_PATH = str(FULL_REG_PATH), str(FULL_BOLD_PATH)
    FONT_REG = pymupdf.Font(fontfile=REG_PATH)
    FONT_BOLD = pymupdf.Font(fontfile=BOLD_PATH)


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as td:
        setup_fonts(td)
        build()
