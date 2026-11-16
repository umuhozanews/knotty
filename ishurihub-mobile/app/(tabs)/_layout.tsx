import React from 'react';
import { Tabs, router, usePathname } from 'expo-router';
import { BottomNav, MainTabType } from '../../components/BottomNav';

export default function TabsLayout() {
  const pathname = usePathname();

  let activeTab: MainTabType = 'home';
  if (pathname.includes('students')) activeTab = 'students';
  else if (pathname.includes('attendance')) activeTab = 'attendance';
  else if (pathname.includes('workers')) activeTab = 'workers';
  else if (pathname.includes('more')) activeTab = 'more';

  const handleTabPress = (tab: MainTabType) => {
    switch (tab) {
      case 'home':
        router.replace('/(tabs)');
        break;
      case 'students':
        router.replace('/(tabs)/students');
        break;
      case 'attendance':
        router.replace('/(tabs)/attendance');
        break;
      case 'workers':
        router.replace('/(tabs)/workers');
        break;
      case 'more':
        router.replace('/(tabs)/more');
        break;
    }
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={() => (
        <BottomNav activeTab={activeTab} onTabPress={handleTabPress} />
      )}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="students" options={{ title: 'Students' }} />
      <Tabs.Screen name="attendance" options={{ title: 'Attendance' }} />
      <Tabs.Screen name="workers" options={{ title: 'Staff' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}
