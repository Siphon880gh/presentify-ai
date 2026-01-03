
import { Presentation, SlideLayout, SlideTransition } from '../types';

export const DEMO_PRESENTATION: Presentation = {
  id: 'demo-123',
  title: 'The Future of Urban Mobility',
  slides: [
    {
      id: 's1',
      title: 'The Future of Urban Mobility',
      subtitle: 'Sustainable, Smart, and Seamless Transportation',
      content: [],
      layout: SlideLayout.TITLE,
      imageUrl: 'https://images.unsplash.com/photo-1449156001437-af90bb425750?auto=format&fit=crop&q=80&w=1280',
      imagePrompt: 'Futuristic city with flying taxis and electric pods, sunset, hyper-realistic',
      transitionType: SlideTransition.ZOOM
    },
    {
      id: 's2',
      title: 'Current Challenges',
      content: [
        'Urban congestion costs cities billions annually',
        'Rising CO2 emissions from traditional combustion engines',
        'Lack of first-mile and last-mile connectivity',
        'Infrastructure aging and inefficiency'
      ],
      layout: SlideLayout.BULLETS,
      imageUrl: 'https://images.unsplash.com/photo-1514924013411-cbf25faa35bb?auto=format&fit=crop&q=80&w=1280',
      imagePrompt: 'Busy city traffic jam, moody lighting',
      transitionType: SlideTransition.FADE
    },
    {
      id: 's3',
      title: 'Electrification & Zero Emissions',
      content: [
        'Electric vehicles (EVs) are now reaching price parity with gas cars.',
        'Battery technology is doubling in efficiency every 5 years.',
        'Cities like Oslo and Paris are banning fossil fuel cars by 2030.'
      ],
      layout: SlideLayout.IMAGE_LEFT,
      imageUrl: 'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&q=80&w=1280',
      imagePrompt: 'Sleek electric car charging at a high-tech station',
      transitionType: SlideTransition.SLIDE
    },
    {
      id: 's4',
      title: 'A Visionary Perspective',
      content: ['"The city of the future is a city built for people, not for cars. Mobility is the bridge between isolation and community."'],
      layout: SlideLayout.QUOTE,
      transitionType: SlideTransition.FADE
    },
    {
      id: 's5',
      title: 'Key Strategic Pillars',
      content: [
        'Autonomous Public Transit',
        'Micromobility (E-bikes & Scooters)',
        'Urban Air Mobility (eVTOL)',
        'Smart Traffic Management'
      ],
      layout: SlideLayout.TWO_COLUMN,
      imageUrl: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&q=80&w=1280',
      imagePrompt: 'A futuristic floating transit pod over a park',
      transitionType: SlideTransition.ZOOM
    }
  ]
};
