'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useMultiplayer, useMultiplayerOptional } from '@/context/MultiplayerContext';
import { useGame } from '@/context/GameContext';
import { Copy, Check, Loader2, Users, UserPlus, Calendar } from 'lucide-react';
import { getMembers, GameMember } from '@/lib/api/coreApi';

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Datum formatieren
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('de-CH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function ShareModal({ open, onOpenChange }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [members, setMembers] = useState<GameMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [myReferralCode, setMyReferralCode] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setMyReferralCode(localStorage.getItem('meinort_referral_code') || '');
    }
  }, [open]);

  const { roomCode, createRoom, municipalitySlug } = useMultiplayer();
  const multiplayer = useMultiplayerOptional();
  const isGuestMode = multiplayer?.isViewOnly ?? false;
  const { state, isStateReady } = useGame();
  
  // Wenn wir in einer Gemeinde sind, verwende die Gemeinde-URL
  const isInMunicipality = municipalitySlug && municipalitySlug !== 'demo';

  // Lade Mitglieder wenn Modal öffnet (nur für Gemeinden, nicht im Guest-Mode)
  useEffect(() => {
    async function loadMembers() {
      // Im Guest-Mode keine Mitglieder laden
      if (isGuestMode) return;
      if (!open || !isInMunicipality || !municipalitySlug) return;
      
      setIsLoadingMembers(true);
      try {
        const memberList = await getMembers(municipalitySlug);
        // Sortiere nach Beitrittsdatum (neueste zuerst) und nimm die letzten 5
        const sortedMembers = memberList
          .sort((a, b) => new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime())
          .slice(0, 5);
        setMembers(sortedMembers);
      } catch (error) {
        console.error('Fehler beim Laden der Mitglieder:', error);
      } finally {
        setIsLoadingMembers(false);
      }
    }
    
    loadMembers();
  }, [open, isInMunicipality, municipalitySlug, isGuestMode]);

  // Create room when modal opens (if not already in a room)
  // IMPORTANT: Wait for isStateReady to ensure we have the loaded state, not the default empty state
  // Skip room creation if we're already in a municipality (room is auto-created there)
  useEffect(() => {
    if (open && !roomCode && !isCreating && isStateReady && !isInMunicipality) {
      setIsCreating(true);
      createRoom(state.cityName, state)
        .then((code) => {
          // Update URL to show room code
          window.history.replaceState({}, '', `/coop/${code}`);
        })
        .catch((err) => {
          console.error('[ShareModal] Failed to create room:', err);
        })
        .finally(() => {
          setIsCreating(false);
        });
    }
  }, [open, roomCode, isCreating, isStateReady, isInMunicipality, createRoom, state]);

  // Reset copied state when modal closes
  useEffect(() => {
    if (!open) {
      setCopied(false);
    }
  }, [open]);

  const handleCopyLink = () => {
    if (!inviteUrl) return;

    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Persönlicher Referral-Link mit Gemeinde vorausgefüllt
  const inviteUrl = isInMunicipality && myReferralCode
    ? `${window.location.origin}/#ref/${myReferralCode}/${municipalitySlug}`
    : isInMunicipality
      ? `${window.location.origin}/#registrieren`
      : roomCode
        ? `${window.location.origin}/coop/${roomCode}`
        : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            {isInMunicipality ? 'Community' : 'Invite Players'}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {isInMunicipality 
              ? 'Lade Freunde ein und baut gemeinsam eure Stadt!' 
              : 'Share this link with friends to play together'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-hidden">
          {isCreating || (!roomCode && !isInMunicipality) ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              <span className="text-slate-400">Creating co-op session...</span>
            </div>
          ) : (
            <>
              {/* Invite Code - nur für Co-op, nicht für Gemeinden */}
              {!isInMunicipality && roomCode && (
                <div className="text-center">
                  <div className="text-4xl font-mono font-bold tracking-widest text-white mb-2">
                    {roomCode}
                  </div>
                  <div className="text-sm text-slate-400">Invite Code</div>
                </div>
              )}
              
              {/* Mitgliederliste - nur für Gemeinden */}
              {isInMunicipality && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Users className="w-4 h-4" />
                    <span>Neueste Mitglieder</span>
                  </div>
                  
                  {isLoadingMembers ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                    </div>
                  ) : members.length > 0 ? (
                    <div className="space-y-2">
                      {members.map((member) => (
                        <div 
                          key={member.id}
                          className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-medium">
                              {member.nickname.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-white">
                                {member.nickname}
                              </div>
                              <div className="text-xs text-slate-500">
                                {member.role === 'owner' ? 'Eigentümer' : 
                                 member.role === 'administrator' ? 'Verwaltung' : 'Mitglied'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-400">
                            <Calendar className="w-3 h-3" />
                            {formatDate(member.joined_at)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-slate-500 text-sm">
                      Noch keine Mitglieder
                    </div>
                  )}
                </div>
              )}

              {/* Einladungs-Bereich */}
              <div className="bg-slate-800/30 rounded-lg p-4 space-y-3 border border-slate-700/50">
                <div className="flex items-center gap-2 text-emerald-400">
                  <UserPlus className="w-5 h-5" />
                  <span className="font-medium">Freunde einladen</span>
                </div>
                <p className="text-sm text-slate-400">
                  {isInMunicipality && myReferralCode
                    ? 'Dein Freund erhält 800 Fr Startguthaben, du bekommst 200 Fr + 100 XP!'
                    : 'Teile diesen Link mit deinen Freunden. Zusammen könnt ihr schneller bauen und mehr erreichen!'}
                </p>
                <div className="w-full bg-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-300 truncate">
                  {inviteUrl}
                </div>
                <Button
                  onClick={handleCopyLink}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Link kopiert!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Link kopieren
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
