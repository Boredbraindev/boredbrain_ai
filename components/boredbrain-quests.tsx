'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

type Quest = {
  id: string;
  title: string;
  description: string;
  reward: number;
  progress: number;
  status: 'active' | 'completed';
};

const quests: Quest[] = [
  {
    id: '1',
    title: 'Deploy Your First Agent',
    description: 'Guide the user through the process of registering and deploying a new AI agent.',
    reward: 100,
    progress: 25,
    status: 'active',
  },
  {
    id: '2',
    title: 'Enter the Arena',
    description: 'Encourage the user to participate in their first Arena match.',
    reward: 50,
    progress: 75,
    status: 'active',
  },
  {
    id: '3',
    title: 'Make a Prediction',
    description: 'Guide the user through the process of making a prediction in the Predictive Market.',
    reward: 50,
    progress: 100,
    status: 'completed',
  },
];

function QuestCard({ quest }: { quest: Quest }) {
  return (
    <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-6 hover:bg-white/[0.08] transition-all">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white/90">{quest.title}</h3>
        <div className="text-sm font-bold text-amber-400">{quest.reward} BBAI</div>
      </div>
      <p className="text-sm text-white/40 mb-4">{quest.description}</p>
      <div className="w-full bg-white/[0.04] rounded-full h-2.5">
        <div
          className="bg-amber-500 h-2.5 rounded-full"
          style={{ width: `${quest.progress}%` }}
        />
      </div>
      <div className="text-right text-xs text-white/30 mt-1">{quest.progress}%</div>
      {quest.status === 'active' && (
        <Button className="mt-4" size="sm">
          View Quest
        </Button>
      )}
    </div>
  );
}

export function BoredBrainQuests() {
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'all'>('active');

  const filteredQuests = quests.filter((quest) => {
    if (activeTab === 'all') return true;
    return quest.status === activeTab;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-4xl font-bold text-center mb-8 text-white/90">BoredBrain Quests</h1>
      <div className="flex justify-center mb-8">
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-1 flex space-x-1">
          <Button
            variant={activeTab === 'active' ? 'secondary' : 'ghost'}
            onClick={() => setActiveTab('active')}
            className="rounded-xl"
          >
            Active
          </Button>
          <Button
            variant={activeTab === 'completed' ? 'secondary' : 'ghost'}
            onClick={() => setActiveTab('completed')}
            className="rounded-xl"
          >
            Completed
          </Button>
          <Button
            variant={activeTab === 'all' ? 'secondary' : 'ghost'}
            onClick={() => setActiveTab('all')}
            className="rounded-xl"
          >
            All
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredQuests.map((quest) => (
          <QuestCard key={quest.id} quest={quest} />
        ))}
      </div>
    </div>
  );
}
