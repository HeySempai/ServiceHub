import { X, DollarSign } from 'lucide-react'
import { Booking, InvoiceInfo, SelectOption } from './types'

interface QuickPayModalProps {
  booking: Booking
  invoice: InvoiceInfo | null
  paymentMethods: SelectOption[]
  payMode: 'new' | 'balance' | ''
  onPayModeChange: (mode: 'new' | 'balance' | '') => void
  payAmount: string
  onPayAmountChange: (amount: string) => void
  payMethodId: string
  onPayMethodChange: (id: string) => void
  payNotes: string
  onPayNotesChange: (notes: string) => void
  onClose: () => void
  saving: boolean
}

export default function QuickPayModal({
  booking,
  invoice,
  paymentMethods,
  payMode,
  onPayModeChange,
  payAmount,
  onPayAmountChange,
  payMethodId,
  onPayMethodChange,
  payNotes,
  onPayNotesChange,
  onClose,
  saving,
}: QuickPayModalProps) {
  const handleSavePayment = async () => {
    // This will be implemented in the container component
    // This component just handles UI
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>
            <DollarSign size={20} />
            Registrar Pago
          </h2>
          <button onClick={onClose} className="btn-close">
            <X size={20} />
          </button>
        </div>

        <div className="quick-pay-form">
          {/* Información de la cita */}
          <div className="booking-info">
            <div className="info-row">
              <span className="label">Cliente:</span>
              <span className="value">
                {booking.clients.first_name} {booking.clients.last_name}
              </span>
            </div>
            <div className="info-row">
              <span className="label">Servicio:</span>
              <span className="value">{booking.services?.name}</span>
            </div>
          </div>

          {/* Información de la factura */}
          {invoice && (
            <div className="invoice-info">
              <div className="info-row">
                <span className="label">Total:</span>
                <span className="value">${invoice.total.toFixed(2)}</span>
              </div>
              <div className="info-row">
                <span className="label">Pagado:</span>
                <span className="value">${invoice.amount_paid.toFixed(2)}</span>
              </div>
              <div className="info-row">
                <span className="label">Saldo:</span>
                <span className="value balance">${invoice.balance_due.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Modo de pago */}
          <div className="form-group">
            <label>Tipo de pago</label>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  value="balance"
                  checked={payMode === 'balance'}
                  onChange={(e) => onPayModeChange(e.target.value as 'balance')}
                />
                Abono a saldo
              </label>
              <label>
                <input
                  type="radio"
                  value="new"
                  checked={payMode === 'new'}
                  onChange={(e) => onPayModeChange(e.target.value as 'new')}
                />
                Pago nuevo
              </label>
            </div>
          </div>

          {/* Monto */}
          <div className="form-group">
            <label>Monto</label>
            <input
              type="number"
              value={payAmount}
              onChange={(e) => onPayAmountChange(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
            />
          </div>

          {/* Método de pago */}
          {paymentMethods.length > 0 && (
            <div className="form-group">
              <label>Método de pago</label>
              <select value={payMethodId} onChange={(e) => onPayMethodChange(e.target.value)}>
                <option value="">Selecciona método</option>
                {paymentMethods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Notas */}
          <div className="form-group">
            <label>Notas</label>
            <textarea
              value={payNotes}
              onChange={(e) => onPayNotesChange(e.target.value)}
              placeholder="Notas del pago..."
              rows={2}
            />
          </div>

          {/* Botones de acción */}
          <div className="form-actions">
            <button onClick={handleSavePayment} className="btn-primary" disabled={saving}>
              {saving ? 'Registrando...' : 'Registrar Pago'}
            </button>
            <button onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
