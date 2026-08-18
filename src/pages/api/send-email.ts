import type { APIRoute } from 'astro';
import { Resend } from 'resend';

export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FROM_ADDRESS = import.meta.env.RESEND_FROM || 'Drafee <noreply@drafee.com>';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_json' }), { status: 400 });
  }

  const { to, answers } = (body ?? {}) as { to?: unknown; answers?: unknown };

  if (typeof to !== 'string' || !EMAIL_RE.test(to)) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_email' }), { status: 400 });
  }
  if (typeof answers !== 'object' || answers === null || Array.isArray(answers)) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_answers' }), { status: 400 });
  }

  const rows = Object.entries(answers as Record<string, unknown>)
    .filter(([, value]) => typeof value === 'string')
    .map(([question, value]) => `<tr><td style="padding:8px 12px;color:#6b7280;font-size:13px;">${escapeHtml(question)}</td><td style="padding:8px 12px;color:#111827;font-size:14px;font-weight:600;">${escapeHtml(String(value) || '—')}</td></tr>`)
    .join('');

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <h2 style="color:#db2777;">แฟนของคุณตอบคำถามแล้ว! 💕</h2>
      <p style="color:#374151;">นี่คือคำตอบที่เค้าฝากมา:</p>
      <table style="width:100%;border-collapse:collapse;background:#fdf2f8;border-radius:12px;overflow:hidden;">${rows}</table>
      <p style="color:#9ca3af;font-size:12px;margin-top:16px;">ส่งจาก Drafee — drafee.com/date-invite</p>
    </div>
  `;

  const apiKey = import.meta.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY is not set');
    return new Response(JSON.stringify({ ok: false, error: 'server_not_configured' }), { status: 500 });
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject: 'แฟนของคุณตอบคำถามชวนเดทแล้ว 💌',
      html,
    });

    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error('Failed to send email via Resend', err);
    return new Response(JSON.stringify({ ok: false, error: 'send_failed' }), { status: 500 });
  }
};
