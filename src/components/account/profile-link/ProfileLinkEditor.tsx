'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { THEME_PRESETS, DEFAULT_THEME } from '@/lib/profile-links/constants';
import {
  saveProfileLinkDataAction,
  checkUsernameAction,
  generateAIBiosAction,
  generateAIThemeAction,
  scrapeLinkMetadataAction,
  type ProfileLinkInput,
} from '@/app/(site)/account/(dashboard)/profile-link/actions';
import type { UserLinkProfile, ProfileLink, ThemeConfig, SocialLinks } from '@/lib/supabase/database.types';
import SocialIconsRow from '@/components/profile-links/SocialIconsRow';
import ProfileLinkCard from '@/components/profile-links/ProfileLinkCard';
import FeaturedToolCard from '@/components/profile-links/FeaturedToolCard';
import { TOOLS } from '@/lib/tools';

interface ProfileLinkEditorProps {
  initialProfile: UserLinkProfile | null;
  initialLinks: ProfileLink[];
  siteUrl: string;
}

const COMMON_EMOJIS = ['🔗', '🚀', '🔥', '💻', '🎨', '📸', '🎵', '⚡', '⭐', '📦', '💡', '🎬', '☕'];

export default function ProfileLinkEditor({ initialProfile, initialLinks, siteUrl }: ProfileLinkEditorProps) {
  const [activeTab, setActiveTab] = useState<'links' | 'appearance' | 'socials' | 'profile' | 'preview'>('links');
  const [isPending, startTransition] = useTransition();

  // Form states
  const [username, setUsername] = useState(initialProfile?.username ?? '');
  const [displayName, setDisplayName] = useState(initialProfile?.display_name ?? '');
  const [bio, setBio] = useState(initialProfile?.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(initialProfile?.avatar_url ?? '');
  const [featuredTool, setFeaturedTool] = useState(initialProfile?.featured_tool_slug ?? '');
  const [isPublished, setIsPublished] = useState(initialProfile?.is_published ?? true);

  const [theme, setTheme] = useState<ThemeConfig>(initialProfile?.theme_config ?? DEFAULT_THEME);
  const [socials, setSocials] = useState<SocialLinks>(initialProfile?.social_links ?? {});

  const [links, setLinks] = useState<ProfileLinkInput[]>(
    initialLinks.map((l) => ({
      id: l.id,
      title: l.title,
      url: l.url,
      icon: l.icon,
      is_active: l.is_active,
      position: l.position,
    }))
  );

  // Status & feedback
  const [feedback, setFeedback] = useState<{ error?: string; notice?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<string | null>(null);

  // AI Assistant states
  const [themePrompt, setThemePrompt] = useState('');
  const [isGeneratingTheme, setIsGeneratingTheme] = useState(false);

  const [showAiBio, setShowAiBio] = useState(false);
  const [bioNiche, setBioNiche] = useState('');
  const [bioTone, setBioTone] = useState<'casual' | 'professional' | 'creative' | 'bold' | 'minimalist'>('casual');
  const [generatedBios, setGeneratedBios] = useState<string[]>([]);
  const [isGeneratingBio, setIsGeneratingBio] = useState(false);

  const [detectingIdx, setDetectingIdx] = useState<number | null>(null);

  const profileUrl = username ? `${siteUrl}/${username}` : '';

  const copyProfileUrl = () => {
    if (!profileUrl) return;
    navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Add Link item
  const handleAddLink = () => {
    const newLink: ProfileLinkInput = {
      title: 'New Link',
      url: 'https://',
      icon: '🔗',
      is_active: true,
      position: links.length,
    };
    setLinks([...links, newLink]);
  };

  const handleUpdateLink = (index: number, updates: Partial<ProfileLinkInput>) => {
    const updated = [...links];
    updated[index] = { ...updated[index], ...updates };
    setLinks(updated);
  };

  const handleRemoveLink = (index: number) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  const handleMoveLink = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === links.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const reordered = [...links];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;
    setLinks(reordered);
  };

  // Smart Link Metadata Auto-detect
  const handleAutoDetect = async (idx: number) => {
    const link = links[idx];
    if (!link?.url || link.url === 'https://') return;

    setDetectingIdx(idx);
    const res = await scrapeLinkMetadataAction(link.url);
    setDetectingIdx(null);

    if (res.title) {
      handleUpdateLink(idx, {
        title: res.title,
        icon: res.icon || link.icon || '🔗',
      });
    }
  };

  // Check username uniqueness
  const handleUsernameBlur = async () => {
    if (!username.trim() || username === initialProfile?.username) {
      setUsernameStatus(null);
      return;
    }
    const res = await checkUsernameAction(username);
    if (!res.available) {
      setUsernameStatus(res.reason || 'Unavailable');
    } else {
      setUsernameStatus('Available!');
    }
  };

  // AI Theme Generator
  const handleGenerateAITheme = async () => {
    if (!themePrompt.trim()) return;
    setIsGeneratingTheme(true);
    const res = await generateAIThemeAction(themePrompt);
    setIsGeneratingTheme(false);

    if (res.theme) {
      setTheme(res.theme);
      setFeedback({ notice: '✨ AI Theme applied! Check the live preview.' });
      setTimeout(() => setFeedback(null), 3500);
    } else if (res.error) {
      setFeedback({ error: res.error });
    }
  };

  // AI Bio Generator
  const handleGenerateAIBios = async () => {
    setIsGeneratingBio(true);
    const res = await generateAIBiosAction({
      name: displayName || 'Creator',
      niche: bioNiche || 'digital creation & tools',
      tone: bioTone,
    });
    setIsGeneratingBio(false);

    if (res.bios && res.bios.length > 0) {
      setGeneratedBios(res.bios);
    } else if (res.error) {
      setFeedback({ error: res.error });
    }
  };

  // Save handler
  const handleSave = () => {
    setFeedback(null);
    startTransition(async () => {
      const res = await saveProfileLinkDataAction({
        username,
        display_name: displayName,
        bio,
        avatar_url: avatarUrl,
        theme_config: theme,
        social_links: socials,
        featured_tool_slug: featuredTool || null,
        is_published: isPublished,
        links,
      });

      if (res.error) {
        setFeedback({ error: res.error });
      } else {
        setFeedback({ notice: 'All changes saved & published to the Edge!' });
        setTimeout(() => setFeedback(null), 4000);
      }
    });
  };

  // Computed phone background
  const getPhoneBackground = () => {
    if (theme.background_type === 'gradient') return { background: theme.background_value };
    if (theme.background_type === 'image')
      return {
        backgroundImage: `url(${theme.background_value})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    return { backgroundColor: theme.background_value };
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className={`w-2.5 h-2.5 rounded-full ${isPublished ? 'bg-emerald-500' : 'bg-amber-400'}`} />
              <h2 className="text-lg font-bold text-slate-900 truncate">
                {username ? `@${username}` : 'Claim your link handle'}
              </h2>
              {isPublished ? (
                <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">
                  Live
                </span>
              ) : (
                <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full">
                  Draft
                </span>
              )}
            </div>
            {username && (
              <p className="text-xs sm:text-sm text-slate-500 mt-1 truncate">
                <span className="font-mono text-slate-700">{profileUrl}</span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {username && (
              <>
                <button
                  type="button"
                  onClick={copyProfileUrl}
                  className="px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition"
                >
                  {copied ? '✓ Copied!' : 'Copy Link'}
                </button>
                <Link
                  href={`/${username}`}
                  target="_blank"
                  className="px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition"
                >
                  View Live ↗
                </Link>
              </>
            )}

            <button
              type="button"
              onClick={() => {
                setActiveTab('links');
                handleAddLink();
              }}
              className="px-4 py-2 text-xs sm:text-sm font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>+ Add Link</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="px-5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition disabled:opacity-50"
            >
              {isPending ? 'Publishing...' : 'Save & Publish'}
            </button>
          </div>
        </div>

        {feedback?.error && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm border border-red-200">
            {feedback.error}
          </div>
        )}
        {feedback?.notice && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm border border-emerald-200">
            {feedback.notice}
          </div>
        )}
      </div>

      {/* Editor & Preview Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Tabbed Settings (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 overflow-x-auto pb-px">
            {[
              { id: 'links', label: '🔗 Links' },
              { id: 'appearance', label: '🎨 Appearance' },
              { id: 'socials', label: '📱 Socials' },
              { id: 'profile', label: '⚙️ Profile & Tool' },
              { id: 'preview', label: '📱 Live Preview (Mobile)', mobileOnly: true },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-4 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                  tab.mobileOnly ? 'lg:hidden' : ''
                } ${
                  activeTab === tab.id
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: LINKS */}
          {activeTab === 'links' && (
            <div className="space-y-4 pt-2">
              {/* Prominent High-Visibility Add Link Action */}
              <button
                type="button"
                onClick={handleAddLink}
                className="w-full py-4 px-5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold text-base flex items-center justify-center gap-2.5 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                <span className="text-2xl leading-none font-extrabold">+</span>
                <span>Add New Link</span>
              </button>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Your Links ({links.length})
                </span>
                <span className="text-xs text-slate-400">Drag or use arrows to reorder</span>
              </div>

              {links.length === 0 ? (
                <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto text-xl">
                    🔗
                  </div>
                  <h4 className="text-base font-bold text-slate-800">No links added yet</h4>
                  <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
                    Add links to your social profiles, website, shop, portfolio, or favorite tools.
                  </p>
                  <button
                    type="button"
                    onClick={handleAddLink}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition"
                  >
                    <span>+ Add Your First Link</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {links.map((link, idx) => (
                    <div
                      key={link.id ?? `link-${idx}`}
                      className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleMoveLink(idx, 'up')}
                            disabled={idx === 0}
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 text-xs"
                            title="Move Up"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveLink(idx, 'down')}
                            disabled={idx === links.length - 1}
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 text-xs"
                            title="Move Down"
                          >
                            ▼
                          </button>
                          <span className="text-xs font-semibold text-slate-400 ml-1">#{idx + 1}</span>
                        </div>

                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={link.is_active}
                              onChange={(e) => handleUpdateLink(idx, { is_active: e.target.checked })}
                              className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span>Active</span>
                          </label>

                          <button
                            type="button"
                            onClick={() => handleRemoveLink(idx)}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Icon</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={link.icon ?? ''}
                              onChange={(e) => handleUpdateLink(idx, { icon: e.target.value })}
                              placeholder="🔗"
                              className="w-full text-center px-2 py-1.5 rounded-lg border border-slate-200 text-sm"
                            />
                          </div>
                        </div>

                        <div className="sm:col-span-5">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Title</label>
                          <input
                            type="text"
                            value={link.title}
                            onChange={(e) => handleUpdateLink(idx, { title: e.target.value })}
                            placeholder="My Portfolio"
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-800"
                          />
                        </div>

                        <div className="sm:col-span-5">
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-semibold text-slate-600">Destination URL</label>
                            <button
                              type="button"
                              onClick={() => handleAutoDetect(idx)}
                              disabled={detectingIdx === idx || !link.url || link.url === 'https://'}
                              className="text-[11px] font-medium text-blue-600 hover:text-blue-800 disabled:opacity-40"
                            >
                              {detectingIdx === idx ? 'Detecting...' : '✨ Auto-fill'}
                            </button>
                          </div>
                          <input
                            type="url"
                            value={link.url}
                            onChange={(e) => handleUpdateLink(idx, { url: e.target.value })}
                            placeholder="https://example.com"
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-mono text-xs text-slate-800"
                          />
                        </div>
                      </div>

                      {/* Quick Emoji Picker */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] text-slate-400 mr-1">Quick icon:</span>
                        {COMMON_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleUpdateLink(idx, { icon: emoji })}
                            className="text-sm p-1 rounded hover:bg-slate-100 transition"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddLink}
                    className="w-full py-3.5 px-4 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/60 hover:bg-blue-50/50 text-slate-600 hover:text-blue-700 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <span className="text-base font-bold">+</span>
                    <span>Add Another Link</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: APPEARANCE */}
          {activeTab === 'appearance' && (
            <div className="space-y-6 pt-2">
              {/* AI Theme Generator */}
              <div className="bg-gradient-to-r from-blue-50/70 via-purple-50/70 to-indigo-50/70 rounded-2xl border border-indigo-100 p-4 sm:p-5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">✨</span>
                    <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                      AI Theme & Palette Generator
                    </h4>
                  </div>
                  <span className="text-[11px] bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded-full">
                    AI Powered
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Type any aesthetic or vibe (e.g. &ldquo;Cyberpunk neon purple coder&rdquo;, &ldquo;Warm coffee pastel aesthetic&rdquo;).
                </p>
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={themePrompt}
                    onChange={(e) => setThemePrompt(e.target.value)}
                    placeholder="e.g. Tokyo midnight neon with emerald accents..."
                    className="flex-1 text-xs px-3.5 py-2.5 rounded-xl bg-white border border-indigo-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateAITheme}
                    disabled={isGeneratingTheme || !themePrompt.trim()}
                    className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition disabled:opacity-50"
                  >
                    {isGeneratingTheme ? 'Designing...' : 'Generate Theme'}
                  </button>
                </div>
              </div>

              {/* Presets */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Theme Presets</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {THEME_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setTheme(preset.config)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        theme.theme === preset.id
                          ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className={`h-12 w-full rounded-lg mb-2 shadow-inner ${preset.previewBg}`} />
                      <div className="text-xs font-bold text-slate-800 truncate">{preset.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Styles */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-900">Custom Colors & Style</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Background Color / Gradient
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={theme.background_value.startsWith('#') ? theme.background_value : '#0f172a'}
                        onChange={(e) =>
                          setTheme({
                            ...theme,
                            theme: 'custom',
                            background_type: 'color',
                            background_value: e.target.value,
                          })
                        }
                        className="w-10 h-10 rounded border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={theme.background_value}
                        onChange={(e) =>
                          setTheme({
                            ...theme,
                            theme: 'custom',
                            background_type: e.target.value.includes('gradient') ? 'gradient' : 'color',
                            background_value: e.target.value,
                          })
                        }
                        className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-200 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Button Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={theme.card_color.startsWith('#') ? theme.card_color : '#1e293b'}
                        onChange={(e) => setTheme({ ...theme, theme: 'custom', card_color: e.target.value })}
                        className="w-10 h-10 rounded border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={theme.card_color}
                        onChange={(e) => setTheme({ ...theme, theme: 'custom', card_color: e.target.value })}
                        className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-200 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Text Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={theme.text_color.startsWith('#') ? theme.text_color : '#ffffff'}
                        onChange={(e) => setTheme({ ...theme, theme: 'custom', text_color: e.target.value })}
                        className="w-10 h-10 rounded border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={theme.text_color}
                        onChange={(e) => setTheme({ ...theme, theme: 'custom', text_color: e.target.value })}
                        className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-200 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Accent Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={theme.accent_color.startsWith('#') ? theme.accent_color : '#38bdf8'}
                        onChange={(e) => setTheme({ ...theme, theme: 'custom', accent_color: e.target.value })}
                        className="w-10 h-10 rounded border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={theme.accent_color}
                        onChange={(e) => setTheme({ ...theme, theme: 'custom', accent_color: e.target.value })}
                        className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-200 font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Button Shape</label>
                    <select
                      value={theme.card_style}
                      onChange={(e) => setTheme({ ...theme, card_style: e.target.value as ThemeConfig['card_style'] })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    >
                      <option value="rounded">Rounded Box</option>
                      <option value="pill">Pill Shape</option>
                      <option value="shadow">Deep Shadow</option>
                      <option value="glass">Glassmorphism</option>
                      <option value="outline">Clean Outline</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Typography Font</label>
                    <select
                      value={theme.font}
                      onChange={(e) => setTheme({ ...theme, font: e.target.value as ThemeConfig['font'] })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    >
                      <option value="sans">Modern Sans-Serif</option>
                      <option value="serif">Editorial Serif</option>
                      <option value="mono">Developer Monospace</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SOCIALS */}
          {activeTab === 'socials' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 pt-2">
              <h3 className="text-sm font-bold text-slate-900">Connect Your Social Profiles</h3>
              <p className="text-xs text-slate-500">
                Icons will automatically appear at the top of your page. Leave blank to hide.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { key: 'twitter', label: 'X (Twitter)', placeholder: '@username' },
                  { key: 'instagram', label: 'Instagram', placeholder: '@username' },
                  { key: 'youtube', label: 'YouTube', placeholder: '@channel' },
                  { key: 'github', label: 'GitHub', placeholder: 'username' },
                  { key: 'tiktok', label: 'TikTok', placeholder: '@username' },
                  { key: 'linkedin', label: 'LinkedIn', placeholder: 'in/username' },
                  { key: 'discord', label: 'Discord Invite', placeholder: 'discord.gg/xyz' },
                  { key: 'threads', label: 'Threads', placeholder: '@username' },
                  { key: 'email', label: 'Email', placeholder: 'you@domain.com' },
                  { key: 'website', label: 'Custom Website', placeholder: 'https://mysite.com' },
                ].map((s) => (
                  <div key={s.key}>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">{s.label}</label>
                    <input
                      type="text"
                      value={socials[s.key as keyof SocialLinks] ?? ''}
                      onChange={(e) => setSocials({ ...socials, [s.key]: e.target.value })}
                      placeholder={s.placeholder}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: PROFILE & TOOLS */}
          {activeTab === 'profile' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5 pt-2">
              <h3 className="text-sm font-bold text-slate-900">Profile Details & Tool Spotlight</h3>

              <div className="space-y-4">
                {/* Handle / Username */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Your Linktree Handle (URL slug)
                  </label>
                  <div className="flex items-center">
                    <span className="px-3 py-2 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-slate-500 text-xs font-mono">
                      {siteUrl}/
                    </span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                      onBlur={handleUsernameBlur}
                      placeholder="yourname"
                      className="flex-1 px-3 py-2 rounded-r-xl border border-slate-200 text-xs font-mono text-slate-900"
                    />
                  </div>
                  {usernameStatus && (
                    <p
                      className={`text-xs mt-1 ${
                        usernameStatus.includes('Available') ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      {usernameStatus}
                    </p>
                  )}
                </div>

                {/* Display Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Alex Morgan"
                    maxLength={60}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-900"
                  />
                </div>

                {/* Bio + AI Assistant */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Bio ({bio.length}/300)
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAiBio(!showAiBio)}
                      className="text-xs font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1"
                    >
                      <span>✨ AI Bio Assistant</span>
                    </button>
                  </div>

                  {/* AI Bio Generation Panel */}
                  {showAiBio && (
                    <div className="mb-3 p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl space-y-3">
                      <div className="text-xs font-bold text-purple-900">Generate High-Converting Bios</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-purple-800 mb-1">Your Niche / Focus</label>
                          <input
                            type="text"
                            value={bioNiche}
                            onChange={(e) => setBioNiche(e.target.value)}
                            placeholder="e.g. Graphic designer sharing free tools"
                            className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-purple-200 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-purple-800 mb-1">Tone</label>
                          <select
                            value={bioTone}
                            onChange={(e) => setBioTone(e.target.value as typeof bioTone)}
                            className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-purple-200 bg-white"
                          >
                            <option value="casual">Casual & Friendly</option>
                            <option value="professional">Professional & Crisp</option>
                            <option value="creative">Creative & Visionary</option>
                            <option value="bold">Bold & Energetic</option>
                            <option value="minimalist">Minimalist</option>
                          </select>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleGenerateAIBios}
                        disabled={isGeneratingBio}
                        className="w-full py-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition disabled:opacity-50"
                      >
                        {isGeneratingBio ? 'Drafting Bios...' : 'Generate 3 Bio Options'}
                      </button>

                      {generatedBios.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[11px] font-semibold text-purple-900">Click a bio to use it:</span>
                          {generatedBios.map((b, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                setBio(b);
                                setShowAiBio(false);
                              }}
                              className="w-full text-left p-2 rounded-lg bg-white border border-purple-100 hover:border-purple-300 text-xs text-slate-800 transition"
                            >
                              {b}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value.slice(0, 300))}
                    placeholder="Creator, developer, and digital artist. Sharing my favorite tools and links!"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-900"
                  />
                </div>

                {/* Avatar URL */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Avatar Image URL</label>
                  <input
                    type="url"
                    value={avatarUrl ?? ''}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 font-mono"
                  />
                </div>

                {/* Featured Tool Spotlight */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Spotlight a ConvertTools Tool on Your Profile
                  </label>
                  <select
                    value={featuredTool ?? ''}
                    onChange={(e) => setFeaturedTool(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-900"
                  >
                    <option value="">None (don&apos;t feature a tool)</option>
                    {TOOLS.map((t) => (
                      <option key={t.href} value={t.href}>
                        [{t.dept.toUpperCase()}] {t.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Adds a featured interactive card directing your followers to try this tool.
                  </p>
                </div>

                {/* Publish Toggle */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-slate-800">Publicly Accessible</span>
                    <p className="text-xs text-slate-500">Uncheck to put your page in private draft mode.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)}
                    className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB: MOBILE PREVIEW ONLY */}
          {activeTab === 'preview' && (
            <div className="lg:hidden py-4 flex justify-center">
              <div
                className="w-full max-w-[340px] rounded-[36px] p-4 shadow-2xl border-4 border-slate-800 relative overflow-hidden min-h-[580px] flex flex-col justify-between"
                style={getPhoneBackground()}
              >
                <div>
                  <div className="flex flex-col items-center pt-6">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Avatar"
                        className="w-20 h-20 rounded-full object-cover ring-2 shadow"
                        style={{ borderColor: theme.accent_color }}
                      />
                    ) : (
                      <div
                        className="w-20 h-20 rounded-full flex items-center justify-center font-bold text-xl shadow"
                        style={{ backgroundColor: theme.card_color, color: theme.accent_color }}
                      >
                        {displayName ? displayName.slice(0, 2).toUpperCase() : '@'}
                      </div>
                    )}
                    <h4 className="text-base font-bold mt-3 text-center" style={{ color: theme.text_color }}>
                      {displayName || 'Your Name'}
                    </h4>
                    <p className="text-xs opacity-70" style={{ color: theme.text_color }}>
                      @{username || 'handle'}
                    </p>
                    {bio && (
                      <p className="text-xs text-center mt-2 px-2 opacity-90" style={{ color: theme.text_color }}>
                        {bio}
                      </p>
                    )}
                  </div>

                  <SocialIconsRow socials={socials} textColor={theme.text_color} accentColor={theme.accent_color} />

                  {featuredTool && <FeaturedToolCard toolSlug={featuredTool} theme={theme} />}

                  <div className="space-y-2.5 mt-3">
                    {links
                      .filter((l) => l.is_active)
                      .map((link, i) => (
                        <ProfileLinkCard
                          key={link.id ?? i}
                          link={{ ...link, id: link.id ?? `demo-${i}`, profile_id: '', click_count: 0, created_at: '', updated_at: '', icon: link.icon ?? null }}
                          theme={theme}
                        />
                      ))}
                  </div>
                </div>

                <div className="text-center py-4">
                  <span className="text-[10px] opacity-70" style={{ color: theme.text_color }}>
                    ConvertTools • Free Links
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Sticky Live Phone Mockup on Desktop (5 cols) */}
        <div className="hidden lg:block lg:col-span-5 sticky top-8">
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Live Phone Preview</span>
            <span className="text-xs text-slate-400">Updates in Real-Time</span>
          </div>

          {/* Smartphone Frame */}
          <div className="w-[320px] mx-auto h-[620px] rounded-[44px] p-3 shadow-2xl bg-slate-900 border-4 border-slate-800 ring-1 ring-slate-700/50 relative flex flex-col justify-between overflow-hidden">
            {/* Dynamic Island / Speaker Notch */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-4 bg-black rounded-full z-20 flex items-center justify-end px-2">
              <span className="w-2 h-2 rounded-full bg-slate-800" />
            </div>

            {/* Inner Phone Screen */}
            <div
              className={`w-full h-full rounded-[34px] overflow-y-auto p-4 flex flex-col justify-between scrollbar-none transition-all duration-300 ${
                theme.font === 'serif' ? 'font-serif' : theme.font === 'mono' ? 'font-mono' : 'font-sans'
              }`}
              style={getPhoneBackground()}
            >
              <div>
                {/* Profile Header */}
                <div className="flex flex-col items-center pt-8 pb-2">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      className="w-20 h-20 rounded-full object-cover ring-2 shadow-md"
                      style={{ borderColor: theme.accent_color }}
                    />
                  ) : (
                    <div
                      className="w-20 h-20 rounded-full flex items-center justify-center font-bold text-xl shadow"
                      style={{ backgroundColor: theme.card_color, color: theme.accent_color }}
                    >
                      {displayName ? displayName.slice(0, 2).toUpperCase() : '@'}
                    </div>
                  )}

                  <h4 className="text-base font-bold mt-2.5 text-center px-1" style={{ color: theme.text_color }}>
                    {displayName || 'Your Name'}
                  </h4>
                  <p className="text-xs opacity-75" style={{ color: theme.text_color }}>
                    @{username || 'handle'}
                  </p>

                  {bio && (
                    <p
                      className="text-xs text-center mt-2 px-2 opacity-90 line-clamp-3 leading-relaxed"
                      style={{ color: theme.text_color }}
                    >
                      {bio}
                    </p>
                  )}
                </div>

                {/* Socials */}
                <SocialIconsRow socials={socials} textColor={theme.text_color} accentColor={theme.accent_color} />

                {/* Featured Tool */}
                {featuredTool && <FeaturedToolCard toolSlug={featuredTool} theme={theme} />}

                {/* Links Stack */}
                <div className="space-y-2 mt-2">
                  {links.filter((l) => l.is_active).length > 0 ? (
                    links
                      .filter((l) => l.is_active)
                      .map((link, i) => (
                        <ProfileLinkCard
                          key={link.id ?? i}
                          link={{
                            ...link,
                            id: link.id ?? `demo-${i}`,
                            profile_id: '',
                            click_count: 0,
                            created_at: '',
                            updated_at: '',
                            icon: link.icon ?? null,
                          }}
                          theme={theme}
                        />
                      ))
                  ) : (
                    <div
                      className="text-center py-6 text-xs border border-dashed rounded-xl opacity-60"
                      style={{ borderColor: theme.text_color, color: theme.text_color }}
                    >
                      No active links
                    </div>
                  )}
                </div>
              </div>

              {/* Phone Footer */}
              <div className="text-center py-3">
                <span className="text-[10px] opacity-60" style={{ color: theme.text_color }}>
                  ConvertTools • Free Links
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
