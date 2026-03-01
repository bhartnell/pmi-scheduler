import { NextResponse } from 'next/server';

// The scenario_favorites table was removed from the schema.
// Favorites are now managed client-side via localStorage.
// These endpoints are kept as stubs to avoid 404 errors from any
// remaining client code, but they do nothing.

export async function POST() {
  return NextResponse.json({ success: false, error: 'Favorites are now stored locally.' }, { status: 410 });
}

export async function DELETE() {
  return NextResponse.json({ success: false, error: 'Favorites are now stored locally.' }, { status: 410 });
}
