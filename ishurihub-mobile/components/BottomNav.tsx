import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../constants/theme';
import { Home, Users, ScanLine, Briefcase, LayoutGrid } from 'lucide-react-native';

export type MainTabType = 'home' | 'students' | 'attendance' | 'workers' | 'more';

interface BottomNavProps {
  activeTab: MainTabType;
  onTabPress: (tab: MainTabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabPress }) => {
  const tabs: { id: MainTabType; label: string; icon: any }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'attendance', label: 'Attendance', icon: ScanLine },
    { id: 'workers', label: 'Staff', icon: Briefcase },
    { id: 'more', label: 'More', icon: LayoutGrid },
  ];

  return (
    <View style={styles.navContainer} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const IconComponent = tab.icon;
        return (
          <TouchableOpacity
            key={tab.id}
            onPress={() => onTabPress(tab.id)}
            style={[styles.tabButton, isActive && styles.activeTabButton]}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <IconComponent
              size={22}
              color={isActive ? Colors.primaryDark : Colors.textSecondary}
              strokeWidth={isActive ? 2.2 : 2}
            />
            <Text
              style={[
                styles.tabLabel,
                isActive ? styles.activeTabLabel : styles.inactiveTabLabel,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  navContainer: {
    flexDirection: 'row',
    gap: 2,
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 10,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  tabButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  activeTabButton: {
    backgroundColor: Colors.primaryLight,
  },
  tabLabel: {
    fontSize: 11,
  },
  activeTabLabel: {
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  inactiveTabLabel: {
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
