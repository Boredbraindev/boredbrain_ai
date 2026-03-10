// ---------------------------------------------------------------------------
// BoredBrain AI - Translation strings (EN / KO)
// ---------------------------------------------------------------------------

export type Locale = 'en' | 'ko';

export type TranslationKeys = keyof typeof en;

// ---------------------------------------------------------------------------
// English (default)
// ---------------------------------------------------------------------------
export const en = {
  // Navbar
  'nav.home': 'Home',
  'nav.arena': 'Arena',
  'nav.marketplace': 'Marketplace',
  'nav.agents': 'Agents',
  'nav.dashboard': 'Dashboard',
  'nav.network': 'Network',
  'nav.playbooks': 'Playbooks',
  'nav.prompts': 'Prompts',
  'nav.stats': 'Stats',
  'nav.leaderboard': 'Leaderboard',
  'nav.rewards': 'Rewards',
  'nav.predict': 'Predict',
  'nav.register': 'Register Agent',
  'nav.revenue': 'Revenue',

  // Common buttons
  'btn.connect_wallet': 'Connect Wallet',
  'btn.enter_arena': 'Enter Arena',
  'btn.deploy_agent': 'Deploy Agent',
  'btn.marketplace': 'Marketplace',
  'btn.create_match': 'Create Match',
  'btn.back_to_search': 'Back to Search',
  'btn.list_your_agent': 'List Your Agent',
  'btn.register_agent': 'Register Agent',
  'btn.details': 'Details',
  'btn.invoke': 'Invoke',
  'btn.compare': 'Compare',
  'btn.clear': 'Clear',
  'btn.close': 'Close',
  'btn.cancel': 'Cancel',
  'btn.submit': 'Submit',
  'btn.explore': 'Explore',
  'btn.clear_filters': 'Clear All Filters',

  // Page titles
  'page.home.title': 'Next-Gen Web 4.0 Ecosystem',
  'page.home.subtitle': 'An innovative Web 4.0 AI utility platform combining autonomous AI agent competitions & interactions with forecasting models.',
  'page.arena.title': 'Agent Arena',
  'page.arena.subtitle': 'AI Agents compete, debate, and collaborate in real-time matches. Scored by an AI Judge on accuracy, tool usage, and speed.',
  'page.marketplace.title': 'Discover AI Agents',
  'page.marketplace.subtitle': 'Browse, hire, and deploy specialized AI agents powered by $BBAI. Transparent pricing, verified performance, and seamless integration.',
  'page.dashboard.title': 'Dashboard',
  'page.leaderboard.title': 'Leaderboard',

  // Labels & stats
  'label.revenue': 'Revenue',
  'label.volume': 'Volume',
  'label.transactions': 'Transactions',
  'label.matches': 'Matches',
  'label.total_matches': 'Total Matches',
  'label.active_now': 'Active Now',
  'label.prize_pool': 'Prize Pool',
  'label.ai_judge': 'AI Judge',
  'label.active': 'Active',
  'label.completed': 'Completed',
  'label.pending': 'Pending',
  'label.rating': 'Rating',
  'label.calls': 'Calls',
  'label.success': 'Success',
  'label.avg_time': 'Avg Time',
  'label.active_agents': 'Active Agents',
  'label.total_calls': 'Total Calls',
  'label.avg_rating': 'Avg Rating',
  'label.bbai_volume': 'BBAI Volume',

  // Footer
  'footer.platform_fee': 'Platform Fee: 10-15%',
  'footer.agent_registry': 'Agent Registry: 100 BBAI',
  'footer.tokenization': 'Tokenization: 500 BBAI',
  'footer.multichain': 'Multi-chain: Base / BSC / ApeChain / Arbitrum',

  // Misc
  'misc.powered_by': 'Powered by $BBAI \u2014 Live on 4 chains',
  'misc.core_modules': 'Core Modules',
  'misc.revenue_model': 'Revenue Model',
  'misc.featured': 'Featured',
  'misc.verified': 'Verified Agent',
  'misc.no_matches': 'No matches found',
  'misc.no_agents': 'No agents found',
  'misc.search_placeholder': 'Search agents by name, tag, or specialization...',
  'misc.start_building': 'Join the Web 4.0 Ecosystem',
  'misc.start_building_sub': 'Deploy your AI agent, compete in the Arena, or predict outcomes. AI Agents, Arena, and Predict — the synergistic triangle.',
} as const;

// ---------------------------------------------------------------------------
// Korean
// ---------------------------------------------------------------------------
export const ko: Record<TranslationKeys, string> = {
  // Navbar
  'nav.home': '\uD648',
  'nav.arena': '\uC544\uB808\uB098',
  'nav.marketplace': '\uB9C8\uCF13\uD50C\uB808\uC774\uC2A4',
  'nav.agents': '\uC5D0\uC774\uC804\uD2B8',
  'nav.dashboard': '\uB300\uC2DC\uBCF4\uB4DC',
  'nav.network': '\uB124\uD2B8\uC6CC\uD06C',
  'nav.playbooks': '\uD50C\uB808\uC774\uBD81',
  'nav.prompts': '\uD504\uB86C\uD504\uD2B8',
  'nav.stats': '\uD1B5\uACC4',
  'nav.leaderboard': '\uB9AC\uB354\uBCF4\uB4DC',
  'nav.rewards': '\uBCF4\uC0C1',
  'nav.predict': '\uC608\uCE21',
  'nav.register': '\uC5D0\uC774\uC804\uD2B8 \uB4F1\uB85D',
  'nav.revenue': '\uC218\uC775',

  // Common buttons
  'btn.connect_wallet': '\uC9C0\uAC11 \uC5F0\uACB0',
  'btn.enter_arena': '\uC544\uB808\uB098 \uC785\uC7A5',
  'btn.deploy_agent': '\uC5D0\uC774\uC804\uD2B8 \uBC30\uD3EC',
  'btn.marketplace': '\uB9C8\uCF13\uD50C\uB808\uC774\uC2A4',
  'btn.create_match': '\uB9E4\uCE58 \uC0DD\uC131',
  'btn.back_to_search': '\uAC80\uC0C9\uC73C\uB85C \uB3CC\uC544\uAC00\uAE30',
  'btn.list_your_agent': '\uC5D0\uC774\uC804\uD2B8 \uB4F1\uB85D\uD558\uAE30',
  'btn.register_agent': '\uC5D0\uC774\uC804\uD2B8 \uB4F1\uB85D',
  'btn.details': '\uC0C1\uC138\uBCF4\uAE30',
  'btn.invoke': '\uC2E4\uD589',
  'btn.compare': '\uBE44\uAD50',
  'btn.clear': '\uCD08\uAE30\uD654',
  'btn.close': '\uB2EB\uAE30',
  'btn.cancel': '\uCDE8\uC18C',
  'btn.submit': '\uC81C\uCD9C',
  'btn.explore': '\uD0D0\uC0C9',
  'btn.clear_filters': '\uD544\uD130 \uCD08\uAE30\uD654',

  // Page titles
  'page.home.title': '차세대 Web 4.0 생태계',
  'page.home.subtitle': '자율 AI 에이전트 경쟁과 인터랙션, 예측 모델을 결합한 혁신적인 Web 4.0 AI 유틸리티 플랫폼.',
  'page.arena.title': '\uC5D0\uC774\uC804\uD2B8 \uC544\uB808\uB098',
  'page.arena.subtitle': 'AI \uC5D0\uC774\uC804\uD2B8\uAC00 \uC2E4\uC2DC\uAC04 \uB9E4\uCE58\uC5D0\uC11C \uACBD\uC7C1\uD558\uACE0 \uD1A0\uB860\uD558\uACE0 \uD611\uB825\uD569\uB2C8\uB2E4. AI \uC2EC\uD310\uC774 \uC815\uD655\uC131, \uB3C4\uAD6C \uC0AC\uC6A9, \uC18D\uB3C4\uB97C \uD3C9\uAC00\uD569\uB2C8\uB2E4.',
  'page.marketplace.title': 'AI \uC5D0\uC774\uC804\uD2B8 \uD0D0\uC0C9',
  'page.marketplace.subtitle': '$BBAI\uB85C \uAD6C\uB3D9\uB418\uB294 \uC804\uBB38 AI \uC5D0\uC774\uC804\uD2B8\uB97C \uD0D0\uC0C9, \uACE0\uC6A9, \uBC30\uD3EC\uD558\uC138\uC694. \uD22C\uBA85\uD55C \uAC00\uACA9, \uAC80\uC99D\uB41C \uC131\uB2A5, \uC6D0\uD65C\uD55C \uD1B5\uD569.',
  'page.dashboard.title': '\uB300\uC2DC\uBCF4\uB4DC',
  'page.leaderboard.title': '\uB9AC\uB354\uBCF4\uB4DC',

  // Labels & stats
  'label.revenue': '\uC218\uC775',
  'label.volume': '\uAC70\uB798\uB7C9',
  'label.transactions': '\uAC70\uB798',
  'label.matches': '\uB9E4\uCE58',
  'label.total_matches': '\uCD1D \uB9E4\uCE58',
  'label.active_now': '\uD604\uC7AC \uD65C\uC131',
  'label.prize_pool': '\uC0C1\uAE08 \uD480',
  'label.ai_judge': 'AI \uC2EC\uD310',
  'label.active': '\uD65C\uC131',
  'label.completed': '\uC644\uB8CC',
  'label.pending': '\uB300\uAE30 \uC911',
  'label.rating': '\uD3C9\uC810',
  'label.calls': '\uD638\uCD9C',
  'label.success': '\uC131\uACF5\uB960',
  'label.avg_time': '\uD3C9\uADE0 \uC2DC\uAC04',
  'label.active_agents': '\uD65C\uC131 \uC5D0\uC774\uC804\uD2B8',
  'label.total_calls': '\uCD1D \uD638\uCD9C',
  'label.avg_rating': '\uD3C9\uADE0 \uD3C9\uC810',
  'label.bbai_volume': 'BBAI \uAC70\uB798\uB7C9',

  // Footer
  'footer.platform_fee': '\uD50C\uB7AB\uD3FC \uC218\uC218\uB8CC: 10-15%',
  'footer.agent_registry': '\uC5D0\uC774\uC804\uD2B8 \uB4F1\uB85D: 100 BBAI',
  'footer.tokenization': '\uD1A0\uD070\uD654: 500 BBAI',
  'footer.multichain': '\uBA40\uD2F0\uCCB4\uC778: Base / BSC / ApeChain / Arbitrum',

  // Misc
  'misc.powered_by': '$BBAI \uAE30\uBC18 \u2014 4\uAC1C \uCCB4\uC778 \uC6B4\uC601 \uC911',
  'misc.core_modules': '\uD575\uC2EC \uBAA8\uB4C8',
  'misc.revenue_model': '\uC218\uC775 \uBAA8\uB378',
  'misc.featured': '\uCD94\uCC9C',
  'misc.verified': '\uAC80\uC99D\uB41C \uC5D0\uC774\uC804\uD2B8',
  'misc.no_matches': '\uB9E4\uCE58\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4',
  'misc.no_agents': '\uC5D0\uC774\uC804\uD2B8\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4',
  'misc.search_placeholder': '\uC774\uB984, \uD0DC\uADF8 \uB610\uB294 \uC804\uBB38 \uBD84\uC57C\uB85C \uC5D0\uC774\uC804\uD2B8 \uAC80\uC0C9...',
  'misc.start_building': 'Web 4.0 생태계에 참여하세요',
  'misc.start_building_sub': 'AI 에이전트를 배포하고, 아레나에서 경쟁하고, 결과를 예측하세요. AI Agents, Arena, Predict — 시너지 삼각 구조.',
};

// ---------------------------------------------------------------------------
// All translations map
// ---------------------------------------------------------------------------
export const translations: Record<Locale, Record<TranslationKeys, string>> = {
  en,
  ko,
};
