import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faTableCellsLarge,
  faUsers,
  faUserTie,
  faUserPlus,
  faClock,
  faCalendarCheck,
  faCalendarXmark,
  faCreditCard,
  faFileInvoiceDollar,
  faBuildingColumns,
  faListCheck,
  faAward,
  faGraduationCap,
  faHeadset,
  faRoute,
  faVanShuttle,
  faEnvelopeOpenText,
  faReceipt,
  faChartSimple,
  faGear,
  faBell,
  faMagnifyingGlass,
  faChevronDown,
  faChevronRight,
  faChevronLeft,
  faBars,
  faRightFromBracket,
  faUser,
  faCircleUser,
  faCheck,
  faXmark,
  faCircleCheck,
  faCircleXmark,
  faCircleExclamation,
  faTriangleExclamation,
  faCircleInfo,
  faPlus,
  faFilter,
  faEye,
  faEyeSlash,
  faLock,
  faShieldHalved,
  faArrowRotateRight,
  faFilePdf,
  faFileExcel,
  faPrint,
  faDownload,
  faShareNodes,
  faArrowRight,
  faSpinner,
  faEllipsisVertical,
  faCalendarDays,
  faChartPie,
  faInbox,
  faWallet,
  faClockRotateLeft,
  faBookBookmark,
  faBolt,
  faUmbrellaBeach,
  faSliders,
  faPenToSquare,
  faTrashCan,
  faPlay,
  faPause
} from '@fortawesome/free-solid-svg-icons'

// Centralized icon map for consistent naming and bundle efficiency
const iconMap = {
  // Navigation
  dashboard: faTableCellsLarge,
  employees: faUsers,
  management: faUserTie,
  recruitment: faUserPlus,
  attendance: faClock,
  shifts: faCalendarCheck,
  leave: faCalendarXmark,
  payroll: faCreditCard,
  tax: faFileInvoiceDollar,
  banking: faBuildingColumns,
  tasks: faListCheck,
  performance: faAward,
  training: faGraduationCap,
  helpdesk: faHeadset,
  travel: faRoute,
  transport: faVanShuttle,
  letters: faEnvelopeOpenText,
  expense: faReceipt,
  reports: faChartSimple,
  settings: faGear,
  alerts: faBell,
  security: faShieldHalved,
  calendar: faCalendarDays,

  // UI Actions & Common
  search: faMagnifyingGlass,
  chevronDown: faChevronDown,
  chevronRight: faChevronRight,
  chevronLeft: faChevronLeft,
  menu: faBars,
  logout: faRightFromBracket,
  user: faUser,
  circleUser: faCircleUser,
  check: faCheck,
  close: faXmark,
  success: faCircleCheck,
  danger: faCircleXmark,
  warning: faTriangleExclamation,
  info: faCircleInfo,
  exclamation: faCircleExclamation,
  plus: faPlus,
  filter: faFilter,
  eye: faEye,
  eyeSlash: faEyeSlash,
  lock: faLock,
  refresh: faArrowRotateRight,
  pdf: faFilePdf,
  excel: faFileExcel,
  print: faPrint,
  download: faDownload,
  share: faShareNodes,
  arrowRight: faArrowRight,
  spinner: faSpinner,
  more: faEllipsisVertical,
  sliders: faSliders,
  edit: faPenToSquare,
  pen: faPenToSquare,
  trash: faTrashCan,
  trashCan: faTrashCan,
  delete: faTrashCan,
  play: faPlay,
  pause: faPause,
  users: faUsers,

  // Aliases & FontAwesome Names
  'fa-calendar-check': faCalendarCheck,
  'fa-chart-pie': faChartPie,
  'fa-inbox': faInbox,
  'fa-wallet': faWallet,
  'fa-calendar-days': faCalendarDays,
  'fa-clock-rotate-left': faClockRotateLeft,
  'fa-book-bookmark': faBookBookmark,
  'fa-bolt': faBolt,
  'fa-shield-halved': faShieldHalved,
  'fa-circle-check': faCircleCheck,
  'fa-people-group': faUsers,
  'fa-user-clock': faClock,
  'fa-table-cells': faTableCellsLarge,
  'fa-bell': faBell,
  'fa-umbrella-beach': faUmbrellaBeach,
  'fa-circle-info': faCircleInfo,
  'fa-check': faCheck,
  'fa-sliders': faSliders
}

/**
 * AppIcon — Consolidated Font Awesome Free wrapper
 * @param {string|object} name - Icon key from iconMap or FontAwesome icon definition
 * @param {string} className - Optional Tailwind CSS classes
 * @param {string} size - FontAwesome size prop ('xs', 'sm', 'lg', '1x', '2x', etc.)
 * @param {boolean} spin - If icon should animate spin
 */
export function AppIcon({ name, className = '', size, spin = false, ...props }) {
  let iconDef = name
  if (typeof name === 'string') {
    iconDef = iconMap[name] || iconMap[name.replace(/^fa-/, '')] || faCircleInfo
  }

  return (
    <FontAwesomeIcon
      icon={iconDef}
      className={className}
      size={size}
      spin={spin}
      {...props}
    />
  )
}

export default AppIcon
