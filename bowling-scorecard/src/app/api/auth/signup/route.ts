import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { z } from 'zod';

import { prisma } from '@/server/db/client';

const signupSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8)
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name } = await signupSchema.parseAsync(body);

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      return NextResponse.json({ error: 'Email already registered.' }, { status: 409 });
    }

    const passwordHash = await hash(password, 12);

    await prisma.user.create({
      data: {
        email,
        name,
        passwordHash
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[SIGNUP_ERROR]', error);
    return NextResponse.json({ error: 'Unable to create account.' }, { status: 400 });
  }
}
