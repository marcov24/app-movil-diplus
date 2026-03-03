import { IonButton, IonIcon } from '@ionic/react';
import { trashOutline } from 'ionicons/icons';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Eliminar",
  description = "Remover dato seleccionado"
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white rounded-[24px] shadow-xl w-full max-w-[320px] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start gap-4 mb-5">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0 border border-red-100">
              <IonIcon icon={trashOutline} className="text-red-500 text-xl" />
            </div>
            <div>
              <h3 className="text-gray-900 font-bold text-lg leading-tight">{title}</h3>
              <p className="text-gray-500 text-xs mt-0.5">{description}</p>
            </div>
          </div>

          {/* Body */}
          <div className="text-sm text-gray-600 mb-7 pr-2">
            <strong>¿Estás seguro?</strong> Por favor, revise que el dato seleccionado es el correcto
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <IonButton
              fill="clear"
              className="flex-1 font-bold tracking-wide"
              style={{
                '--background': '#e5e7eb', // gray-200
                '--background-hover': '#d1d5db',
                '--color': '#374151', // gray-700
                '--border-radius': '12px',
                'height': '44px',
                'margin': '0'
              }}
              onClick={onClose}
            >
              No
            </IonButton>
            <IonButton
              fill="solid"
              className="flex-1 font-bold tracking-wide"
              style={{
                '--background': '#ff2a5f', // striking red/pink like in image
                '--background-hover': '#e01e4e',
                '--border-radius': '12px',
                'height': '44px',
                'margin': '0'
              }}
              onClick={() => {
                onConfirm();
                onClose();
              }}
            >
              Sí
            </IonButton>
          </div>
        </div>
      </div>
    </div>
  );
}
