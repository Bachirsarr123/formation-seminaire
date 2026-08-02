'use server';

import { redirect } from 'next/navigation';
import { detruireSessionOrganisateur } from '@/lib/organisateur/session';

export async function deconnecterAction(): Promise<void> {
  await detruireSessionOrganisateur();
  redirect('/organisateur/connexion');
}
