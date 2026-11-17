// Texts of the legal documents shown in the app (Terms of Use and Privacy Policy).
// When a document changes, update LEGAL_VERSION and the date: the version a player
// accepted is saved in their account at sign up.

export const LEGAL_VERSION = '2026-11-17';
export const LEGAL_UPDATED = '17 November 2026';
export const PROJECT_URL = 'https://github.com/Nazarko464623/hamster-challenge';

export type LegalSection = {
  title: string;
  paragraphs: string[];
};

export type LegalDocument = {
  title: string;
  intro: string;
  sections: LegalSection[];
};

export const TERMS_OF_USE: LegalDocument = {
  title: 'Terms of Use',
  intro:
    'These Terms of Use are a public offer to use the Hamster Challenge app. By creating an account you accept them in full. If you do not agree, please do not use the app.',
  sections: [
    {
      title: '1. About the app',
      paragraphs: [
        'Hamster Challenge is a free app where players create battles, submit photos of their results and vote for the best entries.',
        'The app is developed by a student team of Lviv Polytechnic National University as a study project. It is provided "as is", may change, and may be stopped at any time.',
      ],
    },
    {
      title: '2. Your account',
      paragraphs: [
        'You must be at least 14 years old to create an account. If you are under 18, use the app with the consent of a parent or guardian.',
        'Give a real email address and keep your password secret. You are responsible for everything done from your account.',
        'One person, one account. Accounts created to cheat in votes may be deleted.',
      ],
    },
    {
      title: '3. Battles and voting',
      paragraphs: [
        'A battle has three stages: open (players submit entries), voting (entries are closed and players vote) and ended (the winner is decided).',
        'Each player can vote once per entry and cannot vote for their own entry. Results are final once a battle has ended.',
        'Battles have no money prizes. Points, ranks and streaks have no monetary value.',
      ],
    },
    {
      title: '4. Community rules',
      paragraphs: [
        'Upload only photos you took yourself or have the right to share.',
        'Do not post content that is violent, sexual, hateful, insulting, or that shows other people without their consent.',
        'Do not spam, harass other players in messages, or try to break or overload the app.',
        'Propaganda of aggression against Ukraine and symbols of aggressor states are not allowed.',
      ],
    },
    {
      title: '5. Your content',
      paragraphs: [
        'You keep the rights to the photos you upload. By submitting an entry you allow the app to show it to other players in battles, the feed and results.',
        'Battle entries are visible to everyone who opens the battle. Do not upload anything you want to keep private.',
      ],
    },
    {
      title: '6. Breaking the rules',
      paragraphs: [
        'The team may remove content and limit or delete accounts that break these Terms, without prior notice.',
      ],
    },
    {
      title: '7. Liability',
      paragraphs: [
        'The team is not responsible for content posted by players, for losses caused by the app being unavailable, or for the loss of data you did not keep elsewhere.',
      ],
    },
    {
      title: '8. Changes and contact',
      paragraphs: [
        'These Terms may be updated. The date of the current version is shown at the top. If you keep using the app after a change, you accept the new version.',
        `These Terms are governed by the law of Ukraine. Questions and complaints: ${PROJECT_URL}`,
      ],
    },
  ],
};

export const PRIVACY_POLICY: LegalDocument = {
  title: 'Privacy Policy',
  intro:
    'This policy explains what data Hamster Challenge collects, why, and what you can do about it. It follows the Law of Ukraine "On Personal Data Protection".',
  sections: [
    {
      title: '1. What we collect',
      paragraphs: [
        'Account: your email address, nickname and password. The password is stored only in encrypted (hashed) form; nobody in the team can read it.',
        'Activity: battles you create or join, photos you submit, your votes and the direct messages you send to other players.',
        'On your device: app settings such as theme and pinned battles are stored only on your phone.',
        'We do not collect your location, contacts or payment details, and we do not use advertising trackers.',
      ],
    },
    {
      title: '2. Why we use it',
      paragraphs: [
        'To create your account and let you log in.',
        'To run battles: show entries, count votes and decide winners.',
        'To deliver messages between players.',
        'To keep the app safe and to remove content that breaks the Terms of Use.',
      ],
    },
    {
      title: '3. Who can see your data',
      paragraphs: [
        'Other players see your nickname, your battle entries and your results. Your email address is never shown to other players.',
        'Direct messages are visible only to you and the player you are talking to.',
        'Data is stored with Supabase, the service that hosts the app\'s database and files. We do not sell or give your data to anyone else, except when required by law.',
      ],
    },
    {
      title: '4. How long we keep it',
      paragraphs: [
        'We keep your data while your account exists. When an account is deleted, its profile, entries, votes and messages are deleted too.',
      ],
    },
    {
      title: '5. Your rights',
      paragraphs: [
        'You can ask to see the data we have about you, to correct it, or to delete your account and all its data.',
        'You can change your nickname at any time in Settings.',
        `To use these rights, contact the team: ${PROJECT_URL}`,
      ],
    },
    {
      title: '6. Children',
      paragraphs: [
        'The app is not meant for children under 14. If you believe a child under 14 has created an account, contact us and we will delete it.',
      ],
    },
    {
      title: '7. Changes',
      paragraphs: [
        'If this policy changes, we will update the date at the top and, for important changes, ask you to accept it again.',
      ],
    },
  ],
};
