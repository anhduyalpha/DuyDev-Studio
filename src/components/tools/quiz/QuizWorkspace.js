/**
 * QuizWorkspace Component (< 100 lines)
 * Unified single-column workspace orchestrator for AI Quiz Generator.
 * Adhering to Rule 1 & Rule 3 (Minimalism, High Cohesion).
 */

import { renderQuizConfigPanel } from './components/QuizConfigPanel.js';
import { renderQuizResultCard } from './components/QuizResultCard.js';
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
        <div id="quizConfigContainer">
          ${renderQuizConfigPanel(state)}
        </div>

        <div id="quizResultContainer">
          ${renderQuizResultCard(state)}
        </div>
      </div>
    </div>
  `.trim();
}

export { attachQuizListeners };
