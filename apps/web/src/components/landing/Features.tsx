import { motion } from 'framer-motion';
import { MessageSquare, Shield, Zap, Share2 } from 'lucide-react';

const features = [
  {
    name: 'Real-time Messaging',
    description: 'Experience instant message delivery with our powerful real-time infrastructure.',
    icon: MessageSquare,
  },
  {
    name: 'Secure by Design',
    description: 'Your conversations are protected with end-to-end encryption and advanced security measures.',
    icon: Shield,
  },
  {
    name: 'Lightning Fast',
    description: 'Optimized performance ensures smooth communication even under heavy load.',
    icon: Zap,
  },
  {
    name: 'Easy Sharing',
    description: 'Share files, images, and documents seamlessly within your conversations.',
    icon: Share2,
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export const Features = () => {
  return (
    <div className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-primary">
            Everything you need
          </h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            No complicated setup
          </p>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            Get started in minutes with our intuitive platform that provides all the features
            you need for effective communication.
          </p>
        </div>
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none"
        >
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-2">
            {features.map((feature) => (
              <motion.div
                key={feature.name}
                variants={item}
                className="flex flex-col rounded-lg bg-card/50 p-6 backdrop-blur-sm transition-colors hover:bg-card"
              >
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-foreground">
                  <feature.icon
                    className="h-5 w-5 flex-none text-primary"
                    aria-hidden="true"
                  />
                  {feature.name}
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-muted-foreground">
                  <p className="flex-auto">{feature.description}</p>
                </dd>
              </motion.div>
            ))}
          </dl>
        </motion.div>
      </div>
    </div>
  );
}; 