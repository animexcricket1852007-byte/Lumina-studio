import { SampleImage } from '../types';

export const SAMPLE_IMAGES: SampleImage[] = [
  {
    id: 'sample-portrait',
    title: 'Street Portrait',
    description: 'Test Enhance to 4K for recovering crisp skin tones, eyes, and hair texture.',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80',
    recommendedSection: 'enhance',
  },
  {
    id: 'sample-beach',
    title: 'Coastal Rocks',
    description: 'Test Eraser Studio to remove rocks & footsteps using PatchMatch inpainting.',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    recommendedSection: 'eraser',
  },
  {
    id: 'sample-table',
    title: 'Product Cutout',
    description: 'Test Make Transparent to isolate subjects on a clean checkerboard.',
    url: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=1200&q=80',
    recommendedSection: 'eraser',
  },
  {
    id: 'sample-city',
    title: 'Historic Architecture',
    description: 'Test Multi-scale sharpening & CLAHE for micro-contrast on brickwork.',
    url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
    recommendedSection: 'enhance',
  },
];
