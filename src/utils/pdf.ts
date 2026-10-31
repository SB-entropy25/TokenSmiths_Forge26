import { jsPDF } from 'jspdf';
import { Ticket, Cluster } from '../types';

export const generateTicketPdf = (ticket: Ticket, cluster?: Cluster) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Header Bar
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('CIVIC TRIAGE & GRIEVANCE RECORD', 14, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('Official Citizen Grievance Acknowledgement & SLA Tracking Receipt', 14, 28);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 34);

  // Ticket Code Badge
  doc.setFillColor(22, 163, 74); // green-600
  doc.roundedRect(14, 48, 182, 22, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`TICKET ID: ${ticket.ticket_code}`, 22, 62);
  doc.setFontSize(11);
  doc.text(`SEVERITY: LEVEL ${ticket.severity_final} / 5`, 140, 62);

  // Details Grid
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  let y = 84;

  const addField = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(label.toUpperCase(), 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(value || 'N/A', 70, y);
    y += 10;
  };

  addField('Problem Category', ticket.category.replace('_', ' ').toUpperCase());
  addField('Complainant Name', ticket.name);
  addField('Contact Mobile', `XXXXXX${ticket.mobile.slice(-4)} (Protected)`);
  addField('Contact Email', ticket.email);
  addField('GPS Coordinates', `${ticket.lat.toFixed(5)}, ${ticket.lng.toFixed(5)} (±${ticket.accuracy_m || 5}m)`);
  if (cluster?.address) {
    addField('Reverse Geocoded', cluster.address);
  }
  addField('Resolution SLA (ETA)', `${ticket.eta_hours} Hours from dispatch`);
  addField('Current Status', (cluster?.status || 'RECEIVED').toUpperCase());
  if (cluster?.department_name) {
    addField('Assigned Department', cluster.department_name);
  }

  y += 4;
  doc.setDrawColor(203, 213, 225);
  doc.line(14, y, 196, y);
  y += 10;

  // Description & AI Summary
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('CITIZEN DESCRIPTION:', 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  const splitDesc = doc.splitTextToSize(ticket.description, 180);
  doc.text(splitDesc, 14, y);
  y += splitDesc.length * 6 + 6;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('AI VISION & DANGER ASSESSMENT:', 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  const splitAi = doc.splitTextToSize(ticket.ai_summary, 180);
  doc.text(splitAi, 14, y);
  y += splitAi.length * 6 + 10;

  // Danger Badges
  const activeDangers = Object.entries(ticket.danger || {})
    .filter(([_, val]) => Boolean(val))
    .map(([key]) => key.replace(/_/g, ' '));

  if (activeDangers.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text(`ACTIVE SAFETY FLAGS: ${activeDangers.join(' | ').toUpperCase()}`, 14, y);
    y += 12;
  }

  // Footer / Tracking Notice
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, 240, 182, 38, 3, 3, 'F');
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('HOW TO TRACK OR REOPEN:', 20, 248);
  doc.setFont('helvetica', 'normal');
  doc.text('1. Visit the portal and navigate to the "Track Ticket" section.', 20, 254);
  doc.text(`2. Enter Ticket Code: ${ticket.ticket_code} and your mobile last 4 digits (${ticket.mobile.slice(-4)}).`, 20, 260);
  doc.text('3. You can review real-time field progress, department escalation, and inspect proof photos.', 20, 266);
  doc.text('4. If the work is incomplete, you may reopen within 5 days of closure.', 20, 272);

  doc.save(`CivicTicket_${ticket.ticket_code}.pdf`);
};
