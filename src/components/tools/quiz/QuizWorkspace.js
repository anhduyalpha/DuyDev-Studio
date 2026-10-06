/**
 * QuizWorkspace Component (< 100 lines)
 * Unified single-column workspace orchestrator for AI Quiz Generator.
 * Adhering to Rule 1 & Rule 3 (Minimalism, High Cohesion).
 */

import { renderQuizConfigPanel } from './components/QuizConfigPanel.js';
import { renderQuizResultCard } from './components/QuizResultCard.js';
import { renderQuizHistoryList } from './components/QuizHistoryList.js';
import { quizManager } from './hooks/useQuiz.js';
import { attachQuizListeners } from './hooks/useQuizListeners.js';

export function renderQuizWorkspace() {
  const state = quizManager.getState();

  return `
    <div id="quizWorkspaceRoot" class="space-y-6 animate-fadeIn max-w-3xl mx-auto">
      <!-- Top Navigation & Breadcrumb -->
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2 text-xs sm:text-sm text-zinc-400">
          <a href="#" class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#111114] hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition shadow-xs">
            <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i> <span class="hidden xs:inline">Dashboard</span>
          </a>
          <span class="text-zinc-600">/</span>
          <span class="text-zinc-200 font-semibold truncate">Tạo Bài Tập Trắc Nghiệm</span>
        </div>
      </div>

      <!-- Unified Single-Column Flow -->
      <div class="space-y-6">
        <div id="quizConfigContainer" class="${state.isProcessing || state.result ? 'hidden' : ''}">
          ${renderQuizConfigPanel(state)}
        </div>

        <div id="quizResultContainer">
          ${renderQuizResultCard(state)}
        </div>

        <!-- Section Divider: Clear boundary between Active Workspace & Historical Archive -->
        <div class="pt-2">
          <div class="relative flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-zinc-600"></div>
              <span class="text-xs font-semibold uppercase tracking-wider text-zinc-400">Kho lưu trữ & Lịch sử</span>
            </div>
            <div class="h-px bg-gradient-to-r from-zinc-800/80 via-zinc-800/40 to-transparent flex-1 ml-4"></div>
          </div>
        </div>

        <div id="quizHistoryContainer">
          ${renderQuizHistoryList()}
        </div>
      </div>
    </div>
  `.trim();
}

export { attachQuizListeners };
