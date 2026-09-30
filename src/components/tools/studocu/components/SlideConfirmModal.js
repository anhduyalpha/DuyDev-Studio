/**
 * Studocu SlideConfirmModal Component (Compatibility Facade)
 * Delegates slide-to-confirm logic to the universal SlideConfirmModal component.
 */

import {
  renderSlideConfirmModal as renderCommonModal,
  openSlideConfirmModal as openCommonModal,
  closeSlideConfirmModal as closeCommonModal
} from '../../../common/SlideConfirmModal.js';

const MODAL_ID = 'studocuSlideConfirmModal';

export function renderSlideConfirmModal() {
  return renderCommonModal(MODAL_ID);
}

export function openSlideConfirmModal(onConfirm) {
  return openCommonModal({
    modalId: MODAL_ID,
    title: 'Dọn sạch thùng rác',
    description: 'Xóa vĩnh viễn toàn bộ tệp trong thùng rác.',
    warningText: 'Hành động này không thể hoàn tác. Các tệp sẽ bị xóa hoàn toàn khỏi máy chủ.',
    actionText: 'Kéo sang phải để xác nhận',
    confirmingText: 'Đang dọn sạch...',
    onConfirm
  });
}

export function closeSlideConfirmModal() {
  return closeCommonModal(MODAL_ID);
}
