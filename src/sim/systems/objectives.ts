// Objectifs guidés (chapitres) : détection de progression à chaque heure, petites récompenses.
import type { Ctx } from '../context';
import { CHAPTERS } from '../data/objectives';
import { TICKS_PER_HOUR } from '../data/world';
import type { ObjectivesView, WorldState } from '../types';
import { journal } from '../util';
import { applyEffects, check } from './events';

/** Délai d'affichage d'un chapitre terminé avant de passer au suivant. */
const CHAPTER_LINGER = TICKS_PER_HOUR * 12;

export function initObjectives(w: WorldState) {
  w.objectives ??= { chapter: 0, done: {} };
}

export function objectivesHour(ctx: Ctx) {
  const { w } = ctx;
  const o = w.objectives;
  if (!o || o.chapter >= CHAPTERS.length) return;
  const ch = CHAPTERS[o.chapter];
  if (o.chapterDoneTick !== undefined) {
    if (w.tick - o.chapterDoneTick >= CHAPTER_LINGER) {
      o.chapter++;
      o.chapterDoneTick = undefined;
      const next = CHAPTERS[o.chapter];
      if (next) journal(w, `${next.title} : ${next.intro}`, 'info');
    }
    return;
  }
  for (const obj of ch.objectives) {
    if (o.done[obj.id] !== undefined) continue;
    if (!check(ctx, obj.check)) continue;
    o.done[obj.id] = w.tick;
    applyEffects(ctx, obj.reward, {});
    journal(w, `Objectif atteint : ${obj.title}${obj.rewardLabel ? ` (${obj.rewardLabel})` : ''}.`, 'info');
  }
  if (ch.objectives.every((x) => o.done[x.id] !== undefined)) {
    o.chapterDoneTick = w.tick;
    applyEffects(ctx, ch.reward, {});
    journal(w, `${ch.title} — terminé. ${ch.outro}`, 'important');
  }
}

export function objectivesView(w: WorldState): ObjectivesView | undefined {
  const o = w.objectives;
  if (!o || o.chapter >= CHAPTERS.length) return undefined;
  const ch = CHAPTERS[o.chapter];
  return {
    chapter: o.chapter,
    title: ch.title,
    intro: o.chapterDoneTick !== undefined ? ch.outro : ch.intro,
    finished: o.chapterDoneTick !== undefined,
    items: ch.objectives.map((x) => ({ id: x.id, title: x.title, hint: x.hint, done: o.done[x.id] !== undefined, view: x.view, reward: x.rewardLabel })),
  };
}
