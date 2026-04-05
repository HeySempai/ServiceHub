import { X, UserPlus } from 'lucide-react'
import { ServiceOption, SelectOption } from './types'

interface BookingFormProps {
  editing: string | null
  form: {
    client_id: string
    provider_id: string
    date: string
    time: string
    notes: string
    status: string
  }
  onFormChange: (form: any) => void
  selectedServices: ServiceOption[]
  onServicesChange: (services: ServiceOption[]) => void
  clients: SelectOption[]
  services: ServiceOption[]
  providers: SelectOption[]
  showNewClientForm: boolean
  onShowNewClientForm: (show: boolean) => void
  newClientName: string
  onNewClientNameChange: (name: string) => void
  newClientPhone: string
  onNewClientPhoneChange: (phone: string) => void
  onCreateClient: () => void
  onSaveBooking: (e: React.FormEvent) => void
  onClose: () => void
  saving: boolean
}

export default function BookingForm({
  editing,
  form,
  onFormChange,
  selectedServices,
  onServicesChange,
  clients,
  services,
  providers,
  showNewClientForm,
  onShowNewClientForm,
  newClientName,
  onNewClientNameChange,
  newClientPhone,
  onNewClientPhoneChange,
  onCreateClient,
  onSaveBooking,
  onClose,
  saving,
}: BookingFormProps) {
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0)
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration_min, 0)

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>{editing ? 'Editar Cita' : 'Nueva Cita'}</h2>
          <button onClick={onClose} className="btn-close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={onSaveBooking} className="booking-form">
          {/* Cliente */}
          <div className="form-group">
            <label>Cliente</label>
            {!showNewClientForm ? (
              <div className="select-wrapper">
                <select
                  value={form.client_id}
                  onChange={(e) => onFormChange({ ...form, client_id: e.target.value })}
                  required
                >
                  <option value="">Selecciona un cliente</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onShowNewClientForm(true)}
                  className="btn-secondary"
                >
                  <UserPlus size={16} />
                  Nuevo
                </button>
              </div>
            ) : (
              <div className="new-client-form">
                <input
                  type="text"
                  placeholder="Nombre completo"
                  value={newClientName}
                  onChange={(e) => onNewClientNameChange(e.target.value)}
                  autoFocus
                />
                <input
                  type="tel"
                  placeholder="Teléfono (opcional)"
                  value={newClientPhone}
                  onChange={(e) => onNewClientPhoneChange(e.target.value)}
                />
                <div className="form-actions">
                  <button
                    type="button"
                    onClick={onCreateClient}
                    className="btn-primary"
                    disabled={saving}
                  >
                    Crear
                  </button>
                  <button
                    type="button"
                    onClick={() => onShowNewClientForm(false)}
                    className="btn-secondary"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Proveedor */}
          <div className="form-group">
            <label>Proveedor</label>
            <select
              value={form.provider_id}
              onChange={(e) => onFormChange({ ...form, provider_id: e.target.value })}
              required
            >
              <option value="">Selecciona proveedor</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Servicios */}
          <div className="form-group">
            <label>Servicios</label>
            <div className="services-selector">
              {services.map((service) => (
                <label key={service.id} className="service-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedServices.some((s) => s.id === service.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onServicesChange([...selectedServices, service])
                      } else {
                        onServicesChange(selectedServices.filter((s) => s.id !== service.id))
                      }
                    }}
                  />
                  <span className="service-label">
                    {service.label} - ${service.price.toFixed(2)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Resumen de servicios */}
          {selectedServices.length > 0 && (
            <div className="services-summary">
              <div>
                <strong>Duración total:</strong> {totalDuration} min
              </div>
              <div>
                <strong>Precio total:</strong> ${totalPrice.toFixed(2)}
              </div>
            </div>
          )}

          {/* Fecha y hora */}
          <div className="form-row">
            <div className="form-group">
              <label>Fecha</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => onFormChange({ ...form, date: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Hora</label>
              <input
                type="time"
                value={form.time}
                onChange={(e) => onFormChange({ ...form, time: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Estado */}
          <div className="form-group">
            <label>Estado</label>
            <select
              value={form.status}
              onChange={(e) => onFormChange({ ...form, status: e.target.value })}
            >
              <option value="scheduled">Programado</option>
              <option value="completed">Completado</option>
              <option value="no_show">No Asistió</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>

          {/* Notas */}
          <div className="form-group">
            <label>Notas</label>
            <textarea
              value={form.notes}
              onChange={(e) => onFormChange({ ...form, notes: e.target.value })}
              placeholder="Notas adicionales..."
              rows={3}
            />
          </div>

          {/* Botones de acción */}
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
