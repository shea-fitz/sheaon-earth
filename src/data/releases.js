/**
 * Bandcamp releases, newest first when rendered.
 *
 * bandcampUrl — link to the release on Bandcamp (required)
 * embed — Bandcamp embed iframe or EmbeddedPlayer src URL (ignored until release date)
 * placeholderImage — optional square artwork for upcoming releases (defaults to defaultReleasePlaceholder)
 * presaveUrl — optional presave link shown on upcoming release placeholder overlay
 * notesTag — optional note tag for release-specific notes (defaults to lowercase title)
 * credits — optional list of { role, name, url? } entries (shown on /releases only)
 */
export const defaultReleasePlaceholder = '/images/bg/bg1.webp';

export const releases = [
  {
    title: 'Two Perfumes',
    date: '2026-08-28',
    type: 'EP',
    bandcampUrl: 'https://sheaonair.bandcamp.com/',
    embed: '',
    themes:'olfactory impressions, rituals of excess, allure, intimacy,  parts work, adornment, leaving a passing trace of yourself, touching the veil, unfurling',
    credits: [
      { role: 'Flute, production, mixing', name: 'Shea Fitzpatrick' },
      { role: 'Mastering', name: 'Mark Matter', url: 'https://www.recordhouseny.com/' },
      { role: 'Artwork', name: 'Props Supply', url: 'https://props.supply/' },
      { role: 'Guitar (Protector)', name: 'Seb Choe', url: 'https://sebchoe.com/Project-Broken-Spear' },
    ],
  },
  {
    title: 'Thought Loop',
    date: '2025-12-12',
    type: 'single',
    bandcampUrl: 'https://sheaonair.bandcamp.com/track/thought-loop-single',
    embed: '<iframe style="border: 0; width: 350px; height: 350px;" src="https://bandcamp.com/EmbeddedPlayer/track=3245623735/size=large/bgcol=ffffff/linkcol=0687f5/minimal=true/transparent=true/" seamless><a href="https://sheaonair.bandcamp.com/track/thought-loop-single">Thought Loop – Single by shea on air</a></iframe>',
    themes:'pettiness, rumination, snark, irony, obsessive compulsion, feeling like a loser',
    credits: [
      { role: 'Flute, snare drum, production', name: 'Shea Fitzpatrick' },
      { role: 'Mixing & Mastering', name: 'Mark Matter', url: 'https://www.recordhouseny.com/' },
      { role: 'Artwork', name: 'Shea Fitzpatrick' },
    ],
  },
  {
    title: 'First Birthday',
    date: '2025-08-11',
    type: 'EP',
    bandcampUrl: 'https://sheaonair.bandcamp.com/album/first-birthday-ep',
    embed: '<iframe style="border: 0; width: 350px; height: 350px;" src="https://bandcamp.com/EmbeddedPlayer/album=2107613924/size=large/bgcol=ffffff/linkcol=0687f5/minimal=true/transparent=true/" seamless><a href="https://sheaonair.bandcamp.com/album/first-birthday-ep">First Birthday – EP by shea on air</a></iframe>',
    themes: 'neuroplasticity, tinnitus, grief, rebirth, friendship, recovery, routine',
    credits: [
      { role: 'Flute, production', name: 'Shea Fitzpatrick' },
      { role: 'Mixing & Mastering', name: 'Mark Matter', url: 'https://www.recordhouseny.com/' },
      { role: 'Artwork', name: 'Shea Fitzpatrick' },
    ],
  },
];
