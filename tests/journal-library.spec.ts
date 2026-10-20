import { test, expect } from '@playwright/test';
import { journalPages, journalDraftKey, filterJournalPages } from '../src/lib/journal-library';
import { placeJournalToolbar } from '../src/lib/journal-selection';

test('library includes saved pages and unsaved drafts without mutating entries or duplicating dates', () => {
  const original = { id:'saved',date:'2026-10-19',title:'Ma journée',text:'Une marche.',mood:3,revision:2 };
  const empty = {title:'',text:'',mood:3,revision:0};
  const drafts = {
    '2026-10-19':{...original,title:'Ma journée en douceur',baseline:journalDraftKey(original)},
    '2026-10-20':{...empty,text:'Une nouvelle pensée.',baseline:journalDraftKey(empty)},
    '2026-10-21':{...empty,baseline:journalDraftKey(empty)},
  };
  const pages = journalPages([original], drafts);
  expect(pages.map(p=>p.date)).toEqual(['2026-10-20','2026-10-19']);
  expect(pages.every(p=>p.dirty)).toBe(true);
  expect(original.title).toBe('Ma journée');
  const saved = {...original,title:drafts['2026-10-19'].title,revision:3};
  expect(journalPages([saved],{'2026-10-19':{...saved,baseline:journalDraftKey(saved)}})[0].dirty).toBe(false);
});

test('journal search matches accents, content and dates, with an independent draft filter', () => {
  const pages = [
    {title:'Un été calme',text:'Marcher près du fleuve.',date:'2026-10-19',dirty:false},
    {title:'Mon dimanche',text:'Pensée à reprendre',date:'2026-10-18',dirty:true},
  ];
  expect(filterJournalPages(pages,'ETE')).toEqual([pages[0]]);
  expect(filterJournalPages(pages,'fleuve')).toEqual([pages[0]]);
  expect(filterJournalPages(pages,'2026-10-18',true)).toEqual([pages[1]]);
  expect(filterJournalPages(pages,'été',true)).toEqual([]);
});

test('selection toolbar stays near text and inside desktop, mobile and keyboard viewports', () => {
  const desktop = {left:0,top:0,width:1400,height:900};
  const rect = {left:500,top:400,width:200,height:24};
  const size = {width:355,height:65};
  const above = placeJournalToolbar([rect],size,desktop);
  expect(above).toEqual({left:422.5,top:326,visible:true});
  const below = placeJournalToolbar([{...rect,top:15}],size,desktop);
  expect(below.top).toBe(48);
  const mobile = placeJournalToolbar([{left:320,top:500,width:40,height:24}],size,{left:0,top:0,width:390,height:844});
  expect(mobile.left).toBe(23);
  expect(mobile.top+size.height).toBeLessThan(500);
  const keyboard = placeJournalToolbar([{left:20,top:460,width:200,height:24}],size,{left:0,top:300,width:390,height:250});
  expect(keyboard.top).toBeGreaterThanOrEqual(312);
  expect(keyboard.top+size.height).toBeLessThanOrEqual(538);
  expect(placeJournalToolbar([{...rect,top:-200}],size,desktop).visible).toBe(false);
});
