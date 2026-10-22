import Swal from 'sweetalert2';

const SwalToast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3200,
  timerProgressBar: true,
});

export const alertError = (message: string) =>
  Swal.fire({
    icon: 'error',
    title: 'Error',
    text: message,
    confirmButtonColor: '#ef4444',
  });

export const alertSuccess = (message: string) =>
  Swal.fire({
    icon: 'success',
    title: message,
    confirmButtonColor: '#10b981',
  });

export const alertInfo = (message: string) =>
  Swal.fire({
    icon: 'info',
    title: message,
    confirmButtonColor: '#3b82f6',
  });

export const alertWarning = (message: string) =>
  Swal.fire({
    icon: 'warning',
    title: message,
    confirmButtonColor: '#f59e0b',
  });

export const toastSuccess = (message: string) => SwalToast.fire({ icon: 'success', title: message });
export const toastError = (message: string) => SwalToast.fire({ icon: 'error', title: message });
export const toastInfo = (message: string) => SwalToast.fire({ icon: 'info', title: message });

export const confirmAction = async (
  title: string,
  text?: string,
  confirmButtonText: string = 'Yes, continue'
): Promise<boolean> => {
  const result = await Swal.fire({
    icon: 'question',
    title,
    text,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText: 'Cancel',
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#6b7280',
    reverseButtons: true,
  });
  return result.isConfirmed;
};
