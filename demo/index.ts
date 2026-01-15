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
      imageUrl: 'https://images.unsplash.com/photo-1619960535025-3a06477c8ef5?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      imagePrompt: 'Futuristic city with flying taxis and electric pods, sunset, hyper-realistic',
      transitionType: SlideTransition.ZOOM,
      notes: "Welcome everyone. Today we are exploring the transformative landscape of urban mobility. As our cities grow, the way we move within them must evolve to be more sustainable, intelligent, and seamless. We'll look at the technology and strategies shaping the next decade of transportation."
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
      imageUrl: 'https://images.unsplash.com/photo-1514924013411-cbf25faa35bb?auto=format&fit=crop&get=80&w=1280',
      imagePrompt: 'Busy city traffic jam, moody lighting',
      transitionType: SlideTransition.FADE,
      notes: "Before we look at the future, we must acknowledge the present friction. Urban congestion isn't just a nuisance; it's an economic drain. Furthermore, the environmental impact of traditional combustion engines is reaching a critical tipping point, necessitating a radical shift in our infrastructure."
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
      transitionType: SlideTransition.SLIDE,
      notes: "Electrification is the primary driver of change. We are seeing a rapid decline in battery costs, making EVs accessible to the mass market. Regulatory pressure is also mounting, with major global cities setting hard deadlines for the phase-out of fossil fuel vehicles."
    },
    {
      id: 's4',
      title: 'A Visionary Perspective',
      content: ['"The city of the future is a city built for people, not for cars. Mobility is the bridge between isolation and community."'],
      layout: SlideLayout.QUOTE,
      transitionType: SlideTransition.FADE,
      notes: "This quote encapsulates our core philosophy. Technology is merely a tool; the ultimate goal of mobility is to enhance human connection and reclaim our urban spaces for people rather than parking lots and highways."
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
      transitionType: SlideTransition.ZOOM,
      notes: "Finally, let's look at the pillars of our strategy. From autonomous transit that reduces human error to micromobility solutions for short trips, and even the potential of urban air mobility, the goal is a multi-modal system managed by smart AI to optimize flow and reduce wait times."
    }
  ]
};