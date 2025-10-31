import PropTypes from 'prop-types';

/**
 * Tips表示コンポーネント
 * 休憩時間中にITエンジニア向けのTipsを表示
 * タイマーとチャットの間にインライン表示
 */
export function TipsDisplay({ tip, isVisible }) {
  // 非表示時は最小限の高さを確保してレイアウトシフトを防ぐ（相対的な高さ）
  if (!isVisible || !tip) {
    return <div className="min-h-[15vh]" />;
  }

  // カテゴリごとの背景色
  const categoryColors = {
    git: 'bg-orange-50 border-orange-200',
    react: 'bg-blue-50 border-blue-200',
    teamwork: 'bg-green-50 border-green-200',
    javascript: 'bg-yellow-50 border-yellow-200',
    tools: 'bg-purple-50 border-purple-200',
    performance: 'bg-red-50 border-red-200',
    firebase: 'bg-amber-50 border-amber-200',
    css: 'bg-pink-50 border-pink-200',
    debugging: 'bg-indigo-50 border-indigo-200',
    security: 'bg-rose-50 border-rose-200',
    testing: 'bg-cyan-50 border-cyan-200',
    refactoring: 'bg-lime-50 border-lime-200',
    architecture: 'bg-emerald-50 border-emerald-200',
    collaboration: 'bg-sky-50 border-sky-200',
    productivity: 'bg-violet-50 border-violet-200',
    career: 'bg-fuchsia-50 border-fuchsia-200',
    ai: 'bg-slate-50 border-slate-200',
    documentation: 'bg-stone-50 border-stone-200',
    api: 'bg-zinc-50 border-zinc-200',
    typescript: 'bg-blue-100 border-blue-300',
    monitoring: 'bg-red-100 border-red-300',
    deployment: 'bg-purple-100 border-purple-300',
    ux: 'bg-pink-100 border-pink-300',
    accessibility: 'bg-indigo-100 border-indigo-300',
    npm: 'bg-red-50 border-red-200',
    learning: 'bg-yellow-100 border-yellow-300',
    'mental-health': 'bg-green-50 border-green-300',
    naming: 'bg-purple-50 border-purple-300',
    'version-control': 'bg-orange-50 border-orange-300',
    hooks: 'bg-cyan-100 border-cyan-300',
    optimization: 'bg-red-100 border-red-300',
    'build-tools': 'bg-amber-100 border-amber-300',
    websocket: 'bg-teal-100 border-teal-300',
    livekit: 'bg-violet-100 border-violet-300',
    'component-design': 'bg-pink-100 border-pink-300',
    'data-fetching': 'bg-indigo-100 border-indigo-300',
    'error-handling': 'bg-rose-100 border-rose-300',
    responsive: 'bg-lime-100 border-lime-300',
    innovation: 'bg-fuchsia-100 border-fuchsia-300',
    communication: 'bg-emerald-100 border-emerald-300',
  };

  const colorClass = categoryColors[tip.category] || 'bg-gray-50 border-gray-200';

  // 難易度のラベル
  const difficultyLabels = {
    beginner: '初級',
    intermediate: '中級',
    advanced: '上級',
  };

  return (
    <div className="w-11/12 max-w-2xl mx-auto animate-slide-down">
      <div className={`rounded-lg border-2 ${colorClass} shadow-md p-[clamp(0.75rem,2vh,1rem)]`}>
        {/* ヘッダー */}
        <div className="flex items-center gap-[0.5vw] mb-[1.5vh]">
          <span className="text-[clamp(1rem,2.5vh,1.25rem)]">💡</span>
          <span className="font-semibold text-gray-700 text-[clamp(0.875rem,2vh,1rem)]">休憩中のTips</span>
        </div>

        {/* カテゴリと難易度 */}
        <div className="flex gap-[0.5vw] mb-[1.5vh]">
          <span className="px-[clamp(0.375rem,1vw,0.5rem)] py-[clamp(0.25rem,0.75vh,0.375rem)] bg-white rounded text-[clamp(0.625rem,1.25vh,0.75rem)] font-medium text-gray-600">
            {tip.category}
          </span>
          <span className="px-[clamp(0.375rem,1vw,0.5rem)] py-[clamp(0.25rem,0.75vh,0.375rem)] bg-white rounded text-[clamp(0.625rem,1.25vh,0.75rem)] font-medium text-gray-600">
            {difficultyLabels[tip.difficulty] || tip.difficulty}
          </span>
        </div>

        {/* Tipsの内容 */}
        <p className="text-gray-800 leading-relaxed text-[clamp(0.75rem,1.75vh,0.875rem)]">{tip.content}</p>
      </div>
    </div>
  );
}

TipsDisplay.propTypes = {
  tip: PropTypes.shape({
    id: PropTypes.string.isRequired,
    category: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    difficulty: PropTypes.string.isRequired,
  }),
  isVisible: PropTypes.bool.isRequired,
};
