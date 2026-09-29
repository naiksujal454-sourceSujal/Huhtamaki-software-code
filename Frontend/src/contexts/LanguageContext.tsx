import { createContext, useState, useContext, type ReactNode, type FC } from 'react';

type Language = 'en' | 'hi';

interface Translations {
  [key: string]: {
    en: string;
    hi: string;
  };
}

export const translations: Translations = {
  // Settings Tab
  'Settings': { en: 'Settings', hi: 'सेटिंग्स' },
  'Dashboard': { en: 'Dashboard', hi: 'डैशबोर्ड' },
  'General Settings': { en: 'General Settings', hi: 'सामान्य सेटिंग्स' },
  'Advance Settings': { en: 'Advance Settings', hi: 'उन्नत सेटिंग्स' },
  'Production Line Setup': { en: 'Production Line Setup', hi: 'उत्पादन लाइन सेटअप' },
  'Logs': { en: 'Logs', hi: 'लॉग्स' },
  'Test': { en: 'Test', hi: 'परीक्षण' },
  'Service Detail': { en: 'Service Detail', hi: 'सेवा विवरण' },
  'Alert Configuration': { en: 'Alert Configuration', hi: 'अलर्ट कॉन्फ़िगरेशन' },
  'Internet Connection': { en: 'Internet Connection', hi: 'इंटरनेट कनेक्शन' },
  'Security': { en: 'Security', hi: 'सुरक्षा' },
  'Platform': { en: 'Platform', hi: 'प्लेटफ़ॉर्म' },
  'System Info': { en: 'System Info', hi: 'सिस्टम जानकारी' },
  'UI': { en: 'UI', hi: 'यूज़र इंटरफ़ेस' },
  
  // Alert Configuration
  'Total alerts': { en: 'Total alerts', hi: 'कुल अलर्ट' },
  'Unacknowledged': { en: 'Unacknowledged', hi: 'अस्वीकृत' },
  'Alert Management': { en: 'Alert Management', hi: 'अलर्ट प्रबंधन' },
  'Scanner Alerts': { en: 'Scanner Alerts', hi: 'स्कैनर अलर्ट' },
  'PLC Alerts': { en: 'PLC Alerts', hi: 'पीएलसी अलर्ट' },
  'Sensor Alerts': { en: 'Sensor Alerts', hi: 'सेंसर अलर्ट' },
  'Network Alerts': { en: 'Network Alerts', hi: 'नेटवर्क अलर्ट' },
  'Display': { en: 'Display', hi: 'प्रदर्शित करें' },
  'Suppress': { en: 'Suppress', hi: 'दबाएं' },
  'Critical': { en: 'Critical', hi: 'गंभीर' },
  'High': { en: 'High', hi: 'उच्च' },
  'Medium': { en: 'Medium', hi: 'मध्यम' },
  'Low': { en: 'Low', hi: 'कम' },
  'Save Configuration': { en: 'Save Configuration', hi: 'कॉन्फ़िगरेशन सहेजें' },

  // Dashboard / Analytics
  'Batch Analytics Dashboard': { en: 'Batch Analytics Dashboard', hi: 'बैच एनालिटिक्स डैशबोर्ड' },
  'Refresh': { en: 'Refresh', hi: 'रीफ्रेश करें' },
  'TOTAL': { en: 'TOTAL', hi: 'कुल' },
  'PASS': { en: 'PASS', hi: 'पास' },
  'FAIL': { en: 'FAIL', hi: 'विफल' },
  'AVG MS': { en: 'AVG MS', hi: 'औसत समय (एमएस)' },
  'PASS RATE': { en: 'PASS RATE', hi: 'पास दर' },
  'Print Verification': { en: 'Print Verification', hi: 'प्रिंट सत्यापन' },
  'WITH VERIFICATION': { en: 'WITH VERIFICATION', hi: 'सत्यापन के साथ' },
  'PRINT PASS': { en: 'PRINT PASS', hi: 'प्रिंट पास' },
  'PRINT FAIL': { en: 'PRINT FAIL', hi: 'प्रिंट विफल' },
  'WITHOUT VERIFICATION': { en: 'WITHOUT VERIFICATION', hi: 'सत्यापन के बिना' },
  'Production Batch': { en: 'Production Batch', hi: 'उत्पादन बैच' },
  'Batch / lot code': { en: 'Batch / lot code', hi: 'बैच / लॉट कोड' },
  'Open Batch': { en: 'Open Batch', hi: 'बैच खोलें' },
  'Pipeline Health': { en: 'Pipeline Health', hi: 'पाइपलाइन स्वास्थ्य' },
  'Queue depth': { en: 'Queue depth', hi: 'कतार की गहराई' },
  'Queue age (s)': { en: 'Queue age (s)', hi: 'कतार की आयु (सेकंड)' },
  'WS clients': { en: 'WS clients', hi: 'डब्लूएस क्लाइंट्स' },
  'audit db write ok total': { en: 'audit db write ok total', hi: 'ऑडिट डीबी लेखन कुल सफल' },
  'Defect Breakdown': { en: 'Defect Breakdown', hi: 'दोष का विवरण' },
  'Seal defects': { en: 'Seal defects', hi: 'सील दोष' },
  'Foil defects': { en: 'Foil defects', hi: 'फ़ॉइल दोष' },
  'OCR defects': { en: 'OCR defects', hi: 'ओसीआर दोष' },
  'Top Failure Reasons': { en: 'Top Failure Reasons', hi: 'विफलता के मुख्य कारण' },
  'Reason': { en: 'Reason', hi: 'कारण' },
  'Count': { en: 'Count', hi: 'गिनती' },
  'Batch History': { en: 'Batch History', hi: 'बैच इतिहास' },
  'Code': { en: 'Code', hi: 'कोड' },
  'Status': { en: 'Status', hi: 'स्थिति' },
  'Pass': { en: 'Pass', hi: 'पास' },
  'Fail': { en: 'Fail', hi: 'विफल' },
  'Opened': { en: 'Opened', hi: 'खोला गया' },
  'Recent Results': { en: 'Recent Results', hi: 'हाल के परिणाम' },
  'Time': { en: 'Time', hi: 'समय' },
  'Preset': { en: 'Preset', hi: 'प्रीसेट' },
  'Image': { en: 'Image', hi: 'छवि' },
  'ms': { en: 'ms', hi: 'एमएस' },
  'Export CSV': { en: 'Export CSV', hi: 'सीएसवी निर्यात करें' },
  
  // Logout Modal
  'User Logout': { en: 'User Logout', hi: 'उपयोगकर्ता लॉगआउट' },
  'Active Session': { en: 'Active Session', hi: 'सक्रिय सत्र' },
  'Are you sure you want to end your session?': { 
    en: 'Are you sure you want to end your session?', 
    hi: 'क्या आप वाकई अपना सत्र समाप्त करना चाहते हैं?' 
  },
  'You will be logged out and returned to the sign-in screen.': { 
    en: 'You will be logged out and returned to the sign-in screen.', 
    hi: 'आप लॉग आउट हो जाएंगे और साइन-इन स्क्रीन पर वापस आ जाएंगे।' 
  },
  'Cancel': { en: 'Cancel', hi: 'रद्द करें' },
  'Log Out': { en: 'Log Out', hi: 'लॉग आउट' },

  // Advance Settings
  'Configure advanced system parameters and performance settings.': {
    en: 'Configure advanced system parameters and performance settings.',
    hi: 'उन्नत सिस्टम पैरामीटर और प्रदर्शन सेटिंग्स कॉन्फ़िगर करें।'
  },
  'Settings saved successfully to persistent memory.': {
    en: 'Settings saved successfully to persistent memory.',
    hi: 'सेटिंग्स स्थायी मेमोरी में सफलतापूर्वक सहेजी गईं।'
  },
  'PLC': { en: 'PLC', hi: 'पीएलसी' },
  'IP Address': { en: 'IP Address', hi: 'आईपी पता' },
  'Inspection Request Alerts': { en: 'Inspection Request Alerts', hi: 'निरीक्षण अनुरोध अलर्ट' },
  'Processing Mode': { en: 'Processing Mode', hi: 'प्रोसेसिंग मोड' },
  'Cache Size': { en: 'Cache Size', hi: 'कैश आकार' },
  'Debug Mode': { en: 'Debug Mode', hi: 'डीबग मोड' },

  // Internet Connection
  'Configure wired Ethernet, wireless Wi-Fi networks, and machine IP routing.': {
    en: 'Configure wired Ethernet, wireless Wi-Fi networks, and machine IP routing.',
    hi: 'वायर्ड ईथरनेट, वायरलेस वाई-फ़ाई नेटवर्क और मशीन आईपी रूटिंग कॉन्फ़िगर करें।'
  },
  'Ethernet': { en: 'Ethernet', hi: 'ईथरनेट' },
  'Wi-Fi': { en: 'Wi-Fi', hi: 'वाई-फ़ाई' },
  'Network Diagnostics': { en: 'Network Diagnostics', hi: 'नेटवर्क डायग्नोस्टिक्स' },

  // Hardware Connections
  'Hardware Connections & Diagnostic Control': { 
    en: 'Hardware Connections & Diagnostic Control', 
    hi: 'हार्डवेयर कनेक्शन और डायग्नोस्टिक नियंत्रण' 
  },
  'Scanner': { en: 'Scanner', hi: 'स्कैनर' },
  'Lights': { en: 'Lights', hi: 'लाइट्स' },
  'USB': { en: 'USB', hi: 'यूएसबी' },
  'Bypass Rejection': { en: 'Bypass Rejection', hi: 'बायपास रिजेक्शन' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');

  const t = (key: string): string => {
    if (translations[key]) {
      return translations[key][language] || key;
    }
    return key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
