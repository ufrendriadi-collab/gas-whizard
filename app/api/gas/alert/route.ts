import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { gasPrice, threshold } = await request.json();

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const message = `🚨 *GAS ALERT!* 🚨\n\nGas sekarang: *${gasPrice} Gwei*\nTarget kamu: *${threshold} Gwei*\n\nWaktunya transaksi! 🧙‍♂️⛽`;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    if (response.ok) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}