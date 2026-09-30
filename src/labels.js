export const ORDER_STATUS = {
  new: 'חדשה',
  in_progress: 'בהכנה',
  ready: 'מוכנה',
  delivered: 'נמסרה',
  cancelled: 'בוטלה',
}

export const DELIVERY = {
  pickup: 'איסוף עצמי',
  delivery: 'משלוח',
}

export const ROLES = {
  admin: 'מנהל',
  staff: 'עובד',
  pending: 'ממתין לאישור',
}

export const money = (n) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }).format(Number(n) || 0)

export const date = (d) => (d ? new Date(d).toLocaleDateString('he-IL') : '')
