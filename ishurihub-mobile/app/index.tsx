import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../context/AuthContext';

export default function IndexRoute() {
  const { user } = useAuth();
  return <Redirect href={user ? '/(tabs)' : '/login'} />;
}
