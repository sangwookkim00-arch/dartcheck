/**
 * 대상 기업 목록 업데이트 스크립트
 * 
 * DART의 타법인출자현황 API를 호출하여 삼성생명이 10% 이상 지분을 보유한
 * 상장기업 목록을 갱신합니다.
 * 
 * 실행: npm run update-targets
 * 
 * 주의: 이 API는 사업보고서/분기보고서 기준이므로,
 * 최신 보고서가 제출된 후에 실행해야 정확한 데이터를 얻을 수 있습니다.
 */

import fs from 'fs';
import { config } from './config.js';
import { getSamsungLifeInvestments } from './dart-api.js';
import type { TargetCompany, DartInvestment } from './types.js';

async function updateTargets() {
  console.log('🔄 삼성생명 타법인 출자현황 조회 시작...');

  // 최근 사업연도 계산 (현재 연도 -1, 사업보고서는 전년도 기준)
  const currentYear = new Date().getFullYear();
  const targetYear = String(currentYear - 1);

  // 보고서 코드 우선순위: 사업보고서 → 3분기 → 반기 → 1분기
  const reportCodes = [
    { code: '11011', name: '사업보고서' },
    { code: '11014', name: '3분기보고서' },
    { code: '11012', name: '반기보고서' },
    { code: '11013', name: '1분기보고서' },
  ];

  let investments: DartInvestment[] = [];

  // 가장 최신 보고서부터 시도
  for (const report of reportCodes) {
    console.log(`  📋 ${targetYear}년 ${report.name} 조회 중...`);
    investments = await getSamsungLifeInvestments(targetYear, report.code);

    if (investments.length > 0) {
      console.log(`  ✅ ${report.name}에서 ${investments.length}건 조회 성공`);
      break;
    }
  }

  // 올해 보고서도 시도
  if (investments.length === 0) {
    console.log(`  📋 ${currentYear}년 보고서 시도 중...`);
    for (const report of reportCodes) {
      investments = await getSamsungLifeInvestments(String(currentYear), report.code);
      if (investments.length > 0) {
        console.log(`  ✅ ${currentYear}년 ${report.name}에서 ${investments.length}건 조회 성공`);
        break;
      }
    }
  }

  if (investments.length === 0) {
    console.error('❌ 타법인 출자현황 데이터를 조회할 수 없습니다.');
    console.log('💡 기존 target-companies.json을 유지합니다.');
    return;
  }

  // 지분율 10% 이상 필터링
  // 왜 parseFloat? → API 응답의 지분율이 문자열("12.34")로 오기 때문
  const filtered = investments.filter(inv => {
    const ratio = parseFloat(inv.trmend_blce_qota_rt);
    return !isNaN(ratio) && ratio >= 10.0;
  });

  console.log(`\n📊 전체 ${investments.length}건 중 지분율 10% 이상: ${filtered.length}건`);
  console.log('---');

  for (const inv of filtered) {
    const ratio = parseFloat(inv.trmend_blce_qota_rt);
    console.log(`  ${inv.inv_prm}: ${ratio}%`);
  }

  // 참고: 이 API 응답에는 corp_code/stock_code가 직접 포함되어 있지 않을 수 있음
  // 실제 운영에서는 DART 고유번호 목록과 매칭이 필요
  console.log('\n⚠️ 위 목록을 확인한 후, data/target-companies.json을 수동으로 업데이트하세요.');
  console.log('   (corp_code와 stockCode는 DART 고유번호 파일에서 확인 가능)');
}

updateTargets().catch(console.error);
