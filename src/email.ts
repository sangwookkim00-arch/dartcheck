/**
 * 이메일 발송 모듈
 * 
 * nodemailer를 사용하여 DART 공시 모니터링 결과를 HTML 이메일로 발송
 * 왜 HTML? → 테이블 형식으로 보고서를 깔끔하게 보여주기 위해
 */

import nodemailer from 'nodemailer';
import { config } from './config.js';
import { getDartReportUrl } from './dart-api.js';
import type { MonitoringResult, EmailResult } from './types.js';

/**
 * SMTP 트랜스포터 생성 (Gmail 기준)
 * 왜 secure: true? → port 465는 SSL/TLS 직접 연결이므로
 */
function createTransporter() {
  return nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: true,
    auth: {
      user: config.email.user,
      pass: config.email.pass,
    },
  });
}

/**
 * 모니터링 결과를 HTML로 변환
 * 공시가 있는 경우와 없는 경우를 구분하여 다른 레이아웃 생성
 */
function buildEmailHtml(results: MonitoringResult[], dateStr: string): string {
  // 공시가 있는 기업만 필터
  const hasDisclosures = results.filter(r => r.disclosures.length > 0);
  const totalDisclosures = hasDisclosures.reduce((sum, r) => sum + r.disclosures.length, 0);

  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif;
      margin: 0;
      padding: 20px;
      background-color: #f5f5f5;
      color: #333;
    }
    .container {
      max-width: 700px;
      margin: 0 auto;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #1a237e 0%, #283593 100%);
      color: #fff;
      padding: 24px 30px;
    }
    .header h1 {
      margin: 0 0 6px 0;
      font-size: 20px;
      font-weight: 700;
    }
    .header .date {
      font-size: 14px;
      opacity: 0.85;
    }
    .body-content {
      padding: 24px 30px;
    }
    .summary-badge {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 20px;
    }
    .badge-found {
      background: #e8f5e9;
      color: #2e7d32;
    }
    .badge-none {
      background: #f3f4f6;
      color: #6b7280;
    }
    .company-section {
      margin-bottom: 20px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
    }
    .company-header {
      background: #f8f9fa;
      padding: 12px 16px;
      font-weight: 600;
      font-size: 15px;
      border-bottom: 1px solid #e5e7eb;
    }
    .company-header .share {
      font-weight: 400;
      font-size: 12px;
      color: #6b7280;
      margin-left: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      background: #f8f9fa;
      padding: 10px 12px;
      text-align: left;
      font-size: 12px;
      font-weight: 600;
      color: #6b7280;
      border-bottom: 1px solid #e5e7eb;
    }
    td {
      padding: 10px 12px;
      font-size: 13px;
      border-bottom: 1px solid #f3f4f6;
    }
    td a {
      color: #1a73e8;
      text-decoration: none;
      font-weight: 500;
    }
    td a:hover {
      text-decoration: underline;
    }
    .no-disclosure {
      text-align: center;
      padding: 40px 20px;
      color: #9ca3af;
    }
    .no-disclosure .icon {
      font-size: 40px;
      margin-bottom: 12px;
    }
    .no-disclosure .text {
      font-size: 16px;
      font-weight: 500;
    }
    .footer {
      padding: 16px 30px;
      background: #f8f9fa;
      font-size: 11px;
      color: #9ca3af;
      text-align: center;
    }
    .target-list {
      margin-top: 16px;
      padding: 12px 16px;
      background: #f8f9fa;
      border-radius: 8px;
      font-size: 12px;
      color: #6b7280;
    }
    .target-list strong {
      display: block;
      margin-bottom: 6px;
      color: #374151;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 DART 대주주 공시 모니터링</h1>
      <div class="date">기준일: ${dateStr} | 삼성생명 보유 기업 대상</div>
    </div>
    <div class="body-content">`;

  if (totalDisclosures > 0) {
    // 공시가 있는 경우
    html += `
      <span class="summary-badge badge-found">📢 ${totalDisclosures}건의 공시 발견</span>`;

    for (const result of hasDisclosures) {
      html += `
      <div class="company-section">
        <div class="company-header">
          ${result.company.name}
          <span class="share">(삼성생명 지분율: ${result.company.shareRatio}%)</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>보고서명</th>
              <th>제출인</th>
              <th>접수일</th>
              <th>보고서</th>
            </tr>
          </thead>
          <tbody>`;

      for (const d of result.disclosures) {
        const dartUrl = getDartReportUrl(d.rcept_no);
        // 접수일을 YYYY-MM-DD 형식으로 변환
        const formattedDate = `${d.rcept_dt.slice(0, 4)}-${d.rcept_dt.slice(4, 6)}-${d.rcept_dt.slice(6, 8)}`;
        html += `
            <tr>
              <td>${d.report_nm}</td>
              <td>${d.flr_nm}</td>
              <td>${formattedDate}</td>
              <td><a href="${dartUrl}" target="_blank">📄 보기</a></td>
            </tr>`;
      }

      html += `
          </tbody>
        </table>
      </div>`;
    }
  } else {
    // 공시가 없는 경우
    html += `
      <span class="summary-badge badge-none">확인 완료</span>
      <div class="no-disclosure">
        <div class="icon">✅</div>
        <div class="text">${dateStr} 기준 대상 기업의<br>주요주주특정증권 관련 공시가 없습니다.</div>
      </div>`;
  }

  // 모니터링 대상 기업 목록 표시
  html += `
      <div class="target-list">
        <strong>📋 모니터링 대상 기업 (삼성생명 지분 10% 이상)</strong>
        ${results.map(r => `${r.company.name}(${r.company.shareRatio}%)`).join(' · ')}
      </div>
    </div>
    <div class="footer">
      이 메일은 DART Open API 기반 자동 발송 메일입니다. | dartcheck v1.0
    </div>
  </div>
</body>
</html>`;

  return html;
}

/**
 * 모니터링 결과를 이메일로 발송
 */
export async function sendReport(
  results: MonitoringResult[],
  dateStr: string
): Promise<EmailResult> {
  const transporter = createTransporter();
  const hasAny = results.some(r => r.disclosures.length > 0);
  const totalCount = results.reduce((sum, r) => sum + r.disclosures.length, 0);

  // 제목: 공시 유무에 따라 다르게 설정
  const subject = hasAny
    ? `[DART] 📢 주요주주 공시 ${totalCount}건 감지 (${dateStr})`
    : `[DART] ✅ 주요주주 공시 없음 (${dateStr})`;

  const html = buildEmailHtml(results, dateStr);

  try {
    const info = await transporter.sendMail({
      from: `"DART 모니터링" <${config.email.user}>`,
      to: config.email.receivers.join(','),
      subject,
      html,
    });

    console.log(`📧 이메일 발송 완료: ${info.messageId}`);
    return { success: true, message: `이메일 발송 성공 (${info.messageId})` };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ 이메일 발송 실패:`, errMsg);
    return { success: false, message: `이메일 발송 실패: ${errMsg}` };
  }
}
