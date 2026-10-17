/**
 * Scribd SlideConfirmModal Component (Compatibility Facade)
 * Delegates slide-to-confirm logic to the universal SlideConfirmModal component.
 */

import {
  renderSlideConfirmModal as renderCommonModal,
  openSlideConfirmModal as openCommonModal,
  closeSlideConfirmModal as closeCommonModal
} from '../../../common/SlideConfirmModal.js';

const MODAL_ID = 'scribdSlideConfirmModal';

export function renderSlideConfirmModal() {
  return renderCommonModal(MODAL_ID);
}

export function openSlideConfirmModal(optionsOrConfirm) {
  const options = typeof optionsOrConfirm === 'function'
    ? { onConfirm: optionsOrConfirm }
    : (optionsOrConfirm || {});

  return openCommonModal({
    modalId: MODAL_ID,
    title: options.title || 'Dọn sạch thùng rác',
    description: options.description || 'Xóa vĩnh viễn toàn bộ tệp trong thùng rác.',
    warningText: options.warningText || 'Hành động này không thể hoàn tác. Các tệp sẽ bị xóa hoàn toàn khỏi máy chủ.',
    actionText: options.actionText || 'Kéo sang phải để xác nhận',
    confirmingText: options.confirmingText || 'Đang dọn sạch...',
    onConfirm: options.onConfirm
  });
}

export function closeSlideConfirmModal() {
  return closeCommonModal(MODAL_ID);
}
