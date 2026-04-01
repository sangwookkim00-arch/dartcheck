/**
 * 로컬 테스트 스크립트
 * 
 * 최근 1년간의 공시를 검색하여 실제 데이터로 이메일 발송 테스트
 */

import axios from 'axios';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import fs from 'fs';
import { config } from './config.js';
import { getDartReportUrl } from './dart-api.js';
import { sendReport } from './email.js';
import type { TargetCompany, DartDisclosure, DartListResponse, MonitoringResult } from './types.js';

dayjs.extend(utc);
dayjs.extend(timezone);

/** 넓은 날짜 범위로 공시를 검색하는 테스트 전용 함수 */
async function searchDisclosuresRange(
  corpCode: string,
  startDate: string,
  endDate: string
): Promise<DartDisclosure[]> {
  try {
    const response = await axios.get<DartListResponse>(config.dart.listUrl, {
      params: {
        crtfc_key: config.dart.apiKey,
        corp_code: corpCode,
        bgn_de: startDate,
        end_de: endDate,
        pblntf_ty: 'D',
        pblntf_detail_ty: 'D002',
        page_count: 100,
      },
      timeout: 15000,
    });

    const data = response.data;

    if (data.status === '013') return [];
    if (data.status !== '000') {
      console.log(`  ⚠️ API 응답: ${data.message} (status: ${data.status})`);
      return [];
    }

    return (data.list || []).filter(d =>
      d.report_nm.includes('주요주주특정증권')
    );
  } catch (error) {
    console.error(`  ❌ API 호출 실패:`, error instanceof Error ? error.message : error);
    return [];
  }
}

async function main() {
  console.log('============================================================');
  console.log('  DART 공시 모니터링 - 로컬 테스트 (최근 1년 범위)');
  console.log('============================================================\n');

  // 대상 기업 로드
  const raw = fs.readFileSync(config.paths.targetCompanies, 'utf-8');
  const companies: TargetCompany[] = JSON.parse(raw);
  console.log(`모니터링 대상: ${companies.map(c => c.name).join(', ')}\n`);

  // 날짜 범위: 최근 1년
  const now = dayjs().tz('Asia/Seoul');
  const endDate = now.format('YYYYMMDD');
  const startDate = now.subtract(1, 'year').format('YYYYMMDD');
  console.log(`검색 기간: ${startDate} ~ ${endDate}\n`);

  const results: MonitoringResult[] = [];
  let totalFound = 0;

  for (const company of companies) {
    console.log(`[검색] ${company.name} (${company.corpCode})...`);
    const disclosures = await searchDisclosuresRange(company.corpCode, startDate, endDate);

    if (disclosures.length > 0) {
      totalFound += disclosures.length;
      console.log(`  >>> ${disclosures.length}건 발견!`);
      for (const d of disclosures) {
        console.log(`      - ${d.report_nm} | ${d.flr_nm} | ${d.rcept_dt}`);
        console.log(`        ${getDartReportUrl(d.rcept_no)}`);
      }
    } else {
      console.log(`  (해당 기간 공시 없음)`);
    }

    results.push({ company, disclosures });

    // API rate limit 방지
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n============================================================`);
  console.log(`검색 결과: 총 ${totalFound}건의 주요주주특정증권 공시 발견`);
  console.log(`============================================================\n`);

  // 이메일 발송
  const dateLabel = `${startDate.slice(0,4)}-${startDate.slice(4,6)}-${startDate.slice(6,8)} ~ ${endDate.slice(0,4)}-${endDate.slice(4,6)}-${endDate.slice(6,8)} (테스트)`;

  console.log('이메일 발송 중...');
  const emailResult = await sendReport(results, dateLabel);
  console.log(emailResult.success ? `✅ ${emailResult.message}` : `❌ ${emailResult.message}`);
}

main().catch(err => {
  console.error('치명적 오류:', err);
  process.exit(1);
});
