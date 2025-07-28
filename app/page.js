'use client';
import React, { useEffect, useState, useRef } from 'react';
import { Github, Menu, X, Code, Globe, Terminal, Users, ChevronRight, Copy, Check } from 'lucide-react';
import * as THREE from 'three';

// Three.js Background Component
const ThreeBackground = () => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Load Three.js dynamically
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    script.onload = () => {
      initThreeJS();
    };
    document.head.appendChild(script);

    const initThreeJS = () => {

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });

      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setClearColor(0x000000, 0);
      sceneRef.current = scene;

      // Create floating objects
      const geometries = [
        new THREE.BoxGeometry(1.2, 1.2, 1.2),
        new THREE.SphereGeometry(0.8, 32, 32),
        new THREE.ConeGeometry(0.7, 1.5, 8),
      ];

      const materials = [
        new THREE.MeshBasicMaterial({ color: 0x4f46e5, roughness: 0.3, metalness: 0.6 }),
        new THREE.MeshBasicMaterial({ color: 0x06b6d4, roughness: 0.3, metalness: 0.6 }),
        new THREE.MeshBasicMaterial({ color: 0x8b5cf6, roughness: 0.3, metalness: 0.6 }),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.6 }),
        new THREE.MeshBasicMaterial({ color: 0xef4444, roughness: 0.3, metalness: 0.6 })
      ];

      const objects = [];
      for (let i = 0; i < 20; i++) {
        const geometry = geometries[Math.floor(Math.random() * geometries.length)];
        const material = materials[Math.floor(Math.random() * materials.length)];
        const mesh = new THREE.Mesh(geometry, material);

        mesh.position.x = (Math.random() - 0.5) * 40;
        mesh.position.y = (Math.random() - 0.5) * 40;
        mesh.position.z = (Math.random() - 0.5) * 40;
        mesh.rotation.x = Math.random() * Math.PI;
        mesh.rotation.y = Math.random() * Math.PI;

        mesh.userData = {
          initialX: mesh.position.x,
          initialY: mesh.position.y,
          initialZ: mesh.position.z,
          rotationSpeed: {
            x: (Math.random() - 0.5) * 0.01,
            y: (Math.random() - 0.5) * 0.01,
            z: (Math.random() - 0.5) * 0.01
          },
          floatSpeed: (Math.random() * 0.01 + 0.005)
        };
        scene.add(mesh);
        objects.push(mesh);
      }

      // Add lights
      scene.add(new THREE.AmbientLight(0x404040, 0.6));
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(10, 10, 5);
      scene.add(directionalLight);

      camera.position.z = 5;

      // Animation loop
      const animate = () => {
        animationRef.current = requestAnimationFrame(animate);
        const time = Date.now() * 0.001;

        objects.forEach((obj, index) => {
          const speed = obj.userData.floatSpeed;
          // Smooth floating movement
          obj.position.x = obj.userData.initialX + Math.cos(time * speed + index) * 3;
          obj.position.y = obj.userData.initialY + Math.sin(time * speed + index * 0.5) * 2;
          obj.position.z = obj.userData.initialZ + Math.sin(time * speed + index * 0.8) * 2.5;
          
          // Rotation animation
          obj.rotation.x += obj.userData.rotationSpeed.x;
          obj.rotation.y += obj.userData.rotationSpeed.y;
          obj.rotation.z += obj.userData.rotationSpeed.z;
        });

        renderer.render(scene, camera);
      };

      const handleResize = () => {
        if (camera && renderer) {
          camera.aspect = window.innerWidth / window.innerHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(window.innerWidth, window.innerHeight);
        }
      };

      window.addEventListener('resize', handleResize);
      if (mountRef.current) mountRef.current.appendChild(renderer.domElement);
      animate();

      const cleanup = () => {
        window.removeEventListener('resize', handleResize);
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        if (mountRef.current && renderer.domElement) {
          mountRef.current.removeChild(renderer.domElement);
        }
        objects.forEach(obj => {
          scene.remove(obj);
          obj.geometry?.dispose();
          obj.material?.dispose();
        });
        renderer.dispose();
      };

      return cleanup;
    };

    return () => {
      // Cleanup will be called when the script loads and creates the cleanup function
    };
  }, []);

  return <div ref={mountRef} className="fixed inset-0 -z-10" />;
};

// Documentation Section Component
const DocsSection = () => {
  const [activeTab, setActiveTab] = useState('getting-started');
  const [copiedCode, setCopiedCode] = useState('');

  const tabs = [
    { id: 'getting-started', label: 'Getting Started', icon: <Code size={20} /> },
    { id: 'languages', label: 'Languages', icon: <Globe size={20} /> },
    { id: 'commands', label: 'Commands', icon: <Terminal size={20} /> },
    { id: 'collaboration', label: 'Collaboration', icon: <Users size={20} /> },
  ];

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  const CodeBlock = ({ code, language, id }) => (
    <div className="relative backdrop-blur-lg bg-white/5 border border-white/20 rounded-xl p-4 mb-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-purple-400 text-sm font-medium">{language}</span>
        <button
          onClick={() => copyToClipboard(code, id)}
          className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-300"
        >
          {copiedCode === id ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
        </button>
      </div>
      <pre className="text-white/90 overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );

  const tabContent = {
    'getting-started': (
      <div className="space-y-8">
        <div className="backdrop-blur-lg bg-white/10 border border-white/20 rounded-2xl p-8">
          <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center"></div>
            Quick Start Guide
          </h3>
          
          {[
            { title: 'Create Your Account', desc: 'Sign up for free and get instant access to our cloud IDE with no setup required.' },
            { title: 'Create or Join Room', desc: 'Create room with a cool username and a password or join the room created by your geek gang. It is safe!!' },
            { title: 'Start Coding', desc: 'Just start coding just like you do on Visual Studio, It is that simple. Do not worry, your gang can guide you through your code with the real-time code sync feature.' }
          ].map((step, i) => (
            <div key={i} className="border-l-4 border-purple-500 pl-6 mb-6">
              <h4 className="text-xl font-semibold text-purple-400 mb-2">Step {i + 1}: {step.title}</h4>
              <p className="text-white/80">{step.desc}</p>
            </div>
          ))}

          <CodeBlock 
            code={`// Your first program
console.log("Hello, Code2Gether!");

function createProject() {
  return {
    name: "My Awesome Project",
    language: "JavaScript"
  };
}`}
            language="JavaScript"
            id="hello-world"
          />
        </div>
      </div>
    ),
    
    'languages': (
      <div className="space-y-8">
        <div className="backdrop-blur-lg bg-white/10 border border-white/20 rounded-2xl p-8">
          <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-600 rounded-lg flex items-center justify-center">🌐</div>
            Supported Languages & Frameworks
          </h3>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { category: 'Web Development', languages: ['JavaScript', 'TypeScript', 'React', 'Vue.js'], color: 'from-yellow-500 to-orange-500' },
              { category: 'Backend', languages: ['Node.js', 'Python', 'Java', 'Go'], color: 'from-green-500 to-teal-500' },
              { category: 'Mobile', languages: ['React Native', 'Flutter', 'Swift'], color: 'from-pink-500 to-purple-500' },
              { category: 'Data Science', languages: ['Python', 'R', 'Julia'], color: 'from-blue-500 to-indigo-500' },
              { category: 'Systems', languages: ['C', 'C++', 'Rust'], color: 'from-red-500 to-pink-500' },
            ].map((category, index) => (
              <div key={index} className="backdrop-blur-lg bg-white/5 border border-white/20 rounded-xl p-6 hover:bg-white/10 transition-all duration-300">
                <div className={`w-12 h-12 bg-gradient-to-r ${category.color} rounded-lg flex items-center justify-center text-white font-bold text-xl mb-4`}>
                  {category.category.charAt(0)}
                </div>
                <h4 className="text-lg font-semibold text-white mb-3">{category.category}</h4>
                <div className="flex flex-wrap gap-2">
                  {category.languages.map((lang, i) => (
                    <span key={i} className="px-3 py-1 bg-white/10 border border-white/20 rounded-full text-sm text-white/80">
                      {lang}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),

    'commands': (
      <div className="space-y-8">
        <div className="backdrop-blur-lg bg-white/10 border border-white/20 rounded-2xl p-8">
          <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">⚡</div>
            Execution Commands & Shortcuts (Yes, it's the same commands)
          </h3>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h4 className="text-lg font-semibold text-purple-400 mb-4">🚀 Run Commands</h4>
              {[
                { key: 'Python', action: 'python <filename>.py' },
                { key: 'HTML', action: 'python3 -m http.server <PORT>' },
                { key: 'C++', action: 'g++ -g <filename>.cpp -o <filename>' }
              ].map((cmd, i) => (
                <div key={i} className="backdrop-blur-lg bg-white/5 border border-white/20 rounded-lg p-4 mb-3">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-mono">{cmd.key}</span>
                    <span className="text-white/70">{cmd.action}</span>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <h4 className="text-lg font-semibold text-purple-400 mb-4">⌨️ Editor Shortcuts(Work In progress)</h4>
              {[
                { key: 'Ctrl + Space', action: 'Code completion' },
                { key: 'Ctrl + /', action: 'Toggle comment' },
                { key: 'Ctrl + D', action: 'Select next occurrence' }
              ].map((cmd, i) => (
                <div key={i} className="backdrop-blur-lg bg-white/5 border border-white/20 rounded-lg p-4 mb-3">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-mono">{cmd.key}</span>
                    <span className="text-white/70">{cmd.action}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),

    'collaboration': (
  <div className="space-y-8">
    <div className="backdrop-blur-lg bg-white/10 border border-white/20 rounded-2xl p-8">
      <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-600 rounded-lg flex items-center justify-center">👥</div>
        Team Collaboration Features
      </h3>

      <div className="grid md:grid-cols-2 gap-8">
        {[
          { title: 'Create Room', color: 'blue-500', desc: 'Create a secure coding room with password protection for your geeky gang.' },
          { title: 'Code Sync', color: 'green-500', desc: 'Real-time code synchronization - see changes as your teammates type.' },
          { title: 'File Creation Sync', color: 'purple-500', desc: 'New files and folders sync instantly across all connected members.' },
          { title: 'Independent Terminal', color: 'orange-500', desc: 'Each member gets their own terminal to test and run code independently.' }
        ].map((feature, i) => (
          <div key={i} className={`border-l-4 border-${feature.color} pl-6`}>
            <h4 className={`text-xl font-semibold text-${feature.color.replace('-500', '-400')} mb-2`}>{feature.title}</h4>
            <p className="text-white/80">{feature.desc}</p>
          </div>
        ))}
      </div>
    </div>

    <div className="grid md:grid-cols-3 gap-6">
      {[
        { icon: '🔐', title: 'Secure Room', desc: 'Password-protected rooms for your trusted coding crew', color: 'blue' },
        { icon: '⚡', title: 'Live Sync', desc: 'Real-time code and file synchronization', color: 'green' },
        { icon: '💻', title: 'Private Terminal', desc: 'Independent terminal for each team member', color: 'purple' }
      ].map((item, i) => (
        <div key={i} className="backdrop-blur-lg bg-white/10 border border-white/20 rounded-2xl p-6">
          <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-2xl mb-4">
            {item.icon}
          </div>
          <h4 className="text-lg font-semibold text-white mb-3">{item.title}</h4>
          <p className="text-white/70 text-sm mb-4">{item.desc}</p>
          <button className={`w-full px-4 py-2 bg-${item.color}-500/20 border border-${item.color}-500/50 text-${item.color}-400 rounded-lg hover:bg-${item.color}-500/30 transition-all duration-300`}>
            {i === 0 ? 'Create Room' : i === 1 ? 'Enable Sync' : 'Access Terminal'}
          </button>
        </div>
      ))}
    </div>

    <div className="backdrop-blur-lg bg-white/10 border border-white/20 rounded-2xl p-6">
      <h4 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <span className="text-2xl">🚀</span> 
        How It Works
      </h4>
      <div className="grid md:grid-cols-3 gap-4 text-sm">
        <div className="text-center">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold mx-auto mb-2">1</div>
          <p className="text-white/80">Create a secure room with password</p>
        </div>
        <div className="text-center">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold mx-auto mb-2">2</div>
          <p className="text-white/80">Share password with your geeky gang</p>
        </div>
        <div className="text-center">
          <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold mx-auto mb-2">3</div>
          <p className="text-white/80">Code together, test independently</p>
        </div>
      </div>
    </div>
  </div>
)
  };

  return (
    <section id="docs" className="relative py-20">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-900/10 to-transparent"></div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white via-blue-400 to-purple-500 bg-clip-text text-transparent">
            Documentation
          </h2>
          <p className="text-xl text-white/70 max-w-2xl mx-auto">
            Everything you need to know to get started and master Code2Gether
          </p>
        </div>

        <div className="backdrop-blur-lg bg-white/10 border border-white/20 rounded-2xl p-2 mb-8">
          <div className="flex flex-wrap justify-center gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-[600px]">
          {tabContent[activeTab]}
        </div>
      </div>
    </section>
  );
};

const HomePage = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const features = [
    { icon: '⚡', title: 'Lightning Fast', description: 'Experience blazing-fast performance with our optimized cloud infrastructure.' },
    { icon: '🔧', title: 'Multi-Language Support', description: 'Support for programming languages including Python, JavaScript, Java, C++.' },
    { icon: '👥', title: 'Real-time Collaboration', description: 'Code together with your team in real-time. Share projects and build together.' },
    { icon: '☁️', title: 'Github storage', description: 'Push your projects to Github just like visual studio code and clone them anytime and continue with your work.'},
    { icon: '🚀', title: 'Deployment Easy with Next', description: 'Deploy your applications instantly with Next hosting.' },
    { icon: '🎨', title: 'Multi-Command support', description:'Customize and run your code on any language, commands that support all your prefered languages.' }
  ];

  const stats = [
    { value: '1M+', label: 'Active Developers' },
    { value: '50+', label: 'Languages Supported' },
    { value: '99.9%', label: 'Uptime Guarantee' },
    { value: '24/7', label: 'Support Available' }
  ];

  const navLinks = [
    { name: 'Home', href: '#home' },
    { name: 'Features', href: '#features' },
    { name: 'Docs', href: '#docs' },
    { name: 'Developer-Info', href: '#developer-info' }
  ];

  // Smooth scroll handler
  const handleNavClick = (e, href) => {
    e.preventDefault();
    const element = document.querySelector(href);
    if (element) {
      const headerHeight = 80; // Height of the fixed header
      const elementPosition = element.offsetTop - headerHeight;
      
      window.scrollTo({
        top: elementPosition,
        behavior: 'smooth'
      });
    }
    setIsMenuOpen(false); // Close mobile menu
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <ThreeBackground />
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-indigo-900/20 backdrop-blur-sm"></div>

      {/* Header */}
      <header className="relative z-50 backdrop-blur-lg bg-white/10 border-b border-white/20 shadow-2xl fixed w-full top-0">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="cursor-pointer text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 text-transparent bg-clip-text hover:scale-105 transition-transform duration-300">
              Code2Gether
            </div>

            <div className="hidden md:flex items-center space-x-1">
              {navLinks.map(link => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className="px-6 py-3 rounded-xl text-white/90 hover:text-white font-medium transition-all duration-300 hover:bg-white/10 hover:scale-105"
                >
                  {link.name}
                </a>
              ))}
              <button className="ml-4 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium rounded-lg shadow-lg transform transition-all duration-300 hover:scale-105" onClick={()=> window.open('https://codetogether-frontend-ten.vercel.app/signup')}>
                Sign Up Free
              </button>
            </div>

            <div className="md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition-all duration-300"
              >
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>

          {isMenuOpen && (
            <div className="md:hidden absolute top-full left-0 right-0 backdrop-blur-lg bg-white/10 border-b border-white/20 shadow-2xl">
              <div className="px-4 py-4 space-y-2">
                {navLinks.map(link => (
                  <a
                    key={link.name}
                    href={link.href}
                    onClick={(e) => handleNavClick(e, link.href)}
                    className="block px-4 py-3 rounded-lg text-white/90 hover:text-white font-medium transition-all duration-300 hover:bg-white/10"
                  >
                    {link.name}
                  </a>
                ))}
                <button className="w-full mt-4 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-lg shadow-lg" onClick={()=> window.open('https://codetogether-frontend-ten.vercel.app/signup')}>
                  Sign Up Free
                </button>
              </div>
            </div>
          )}
        </nav>
      </header>

      <main className="relative z-10 pt-20">
        {/* Hero Section */}
        <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <div className="backdrop-blur-lg bg-white/10 rounded-2xl border border-white/20 shadow-2xl p-8 mb-8">
              <div className="max-w-2xl mx-auto">
                <h1 className="text-5xl md:text-6xl font-extrabold mb-6 bg-gradient-to-r from-white via-purple-400 to-pink-500 bg-clip-text text-transparent leading-tight">
                  Code Anywhere, Anytime
                </h1>
                <p className="text-xl mb-8 text-white/70 leading-relaxed">
                  Experience the future of coding with our powerful online IDE. Build, test, and deploy your projects seamlessly in the cloud.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium rounded-lg shadow-lg transform transition-all duration-300 hover:scale-105 flex items-center justify-center" onClick={()=>window.open('https://codetogether-frontend-ten.vercel.app/signup')}>
                    Start Coding Now
                  </button>
                  <button className="px-8 py-3 bg-white/10 border border-white/20 rounded-lg text-white font-medium hover:bg-white/20 transform transition-all duration-300 hover:scale-105 backdrop-blur-sm" onClick={()=>window.open('https://github.com/PrajwalMundargi')}>
                    View on GitHub
                  </button >
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="relative py-20">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-500/5 to-transparent"></div>
          
          <div className="relative z-10 max-w-6xl mx-auto px-5">
            <h2 className="text-center text-4xl font-bold mb-12 bg-gradient-to-r from-white to-purple-400 bg-clip-text text-transparent">
              Why Choose Code2Gether?
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="group relative backdrop-blur-lg bg-white/10 border border-white/20 rounded-2xl p-8 transition-all duration-300 hover:-translate-y-3 hover:border-purple-500/50 hover:shadow-2xl overflow-hidden"
                >
                  <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-gradient-to-r from-transparent via-purple-500/10 to-transparent transform -rotate-45 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1500 ease-in-out opacity-0 group-hover:opacity-100" />
                  
                  <div className="relative z-10">
                    <div className="w-15 h-15 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center text-2xl mb-4">
                      {feature.icon}
                    </div>
                    <h3 className="text-xl font-semibold mb-4 text-pink-500">{feature.title}</h3>
                    <p className="text-white/80 leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <DocsSection />

       
      </main>

         <footer id="developer-info" className="relative z-10 backdrop-blur-lg bg-white/5 border-t border-white/20 py-12">
  <div className="max-w-7xl mx-auto px-8">
    <div className="grid md:grid-cols-2 gap-8 items-center">
      {/* Left side - About Developer */}
      <div className="text-left">
        <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
          <span className="text-2xl">👨‍💻</span>
          Built by Developer
        </h3>
        <p className="text-white/70 mb-4 leading-relaxed">
          Passionate full-stack developer who loves creating tools that make coding more collaborative and fun. 
          Code2Gether is built with the vision of connecting developers worldwide.
        </p>
        
        {/* Social Links */}
        <div className="flex gap-4">
          {[
            { 
              name: 'GitHub', 
              icon: '🐙', 
              url: 'https://github.com/PrajwalMundargi',
              color: 'hover:text-gray-300'
            },
            { 
              name: 'LinkedIn', 
              icon: '💼', 
              url: 'https://www.linkedin.com/in/prajwal-m-787b6733b/',
              color: 'hover:text-blue-400'
            },
            { 
              name: 'Twitter/X', 
              icon: '🐦', 
              url: ': https://x.com/PraJwa1M?t=b2F-_KV1HxiTCpiPBd_2kQ&s=08 ',
              color: 'hover:text-blue-500'
            },
            { 
              name: 'Instagram', 
              icon: '📸', 
              url: 'https://instagram.com/prxjw.xl',
              color: 'hover:text-pink-400'
            }
          ].map((social, i) => (
            <button
              key={i}
              onClick={() => window.open(social.url, '_blank')}
              className={`flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white/80 ${social.color} transform transition-all duration-300 hover:scale-105 hover:bg-white/20 backdrop-blur-sm`}
              title={`Follow on ${social.name}`}
            >
              <span className="text-lg">{social.icon}</span>
              <span className="text-sm font-medium">{social.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Right side - App Info */}
      <div className="text-right">
        <div className="backdrop-blur-lg bg-white/10 border border-white/20 rounded-2xl p-6">
          <h4 className="text-lg font-bold text-white mb-3 flex items-center justify-end gap-2">
            <span>Code2Gether</span>
            <span className="text-xl">🚀</span>
          </h4>
          <p className="text-white/70 text-sm mb-4">
            The ultimate collaborative coding platform for developers who love to build together.
          </p>
          <div className="flex justify-end gap-2 text-xs">
            <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full border border-green-500/30">
              Live
            </span>
            <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
              v1.0
            </span>
          </div>
        </div>
      </div>
    </div>

    {/* Bottom Copyright */}
    <div className="border-t border-white/10 mt-8 pt-6 text-center">
      <p className="text-white/70 text-sm">
        &copy; 2025 Code2Gether. All rights reserved. Built for developers worldwide.
      </p>
      <p className="text-white/50 text-xs mt-2">
        Made with React, Node.js, and lots of coffee ☕
      </p>
    </div>
  </div>
</footer>
    </div>
  );
};

export default HomePage;