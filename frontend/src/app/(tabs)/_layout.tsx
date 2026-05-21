import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { avatarPublicUrl, supabase } from '@/lib/supabase';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function CenterAddButton(props: BottomTabBarButtonProps) {
  return (
    <Pressable
      onPress={props.onPress as any}
      onLongPress={props.onLongPress as any}
      android_ripple={null}
      style={styles.centerButton}
    >
      <View style={styles.centerCircle}>
        <Ionicons name="camera-outline" size={26} color="#EEF4FB" />
      </View>
    </Pressable>
  );
}

function TabIcon({
  name,
  color,
  size,
}: {
  name: IoniconName;
  color: string;
  size: number;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}

// Caches the current user's avatar path so the header doesn't re-query
// Supabase on every screen mount. Refreshes when auth state flips (e.g. a
// new sign-in) so a different user lands here with their own picture.
function useCurrentAvatarPath(): string | null {
  const [path, setPath] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadOnce() {
      const { data: u } = await supabase.auth.getUser();
      if (cancelled || !u.user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('user_id', u.user.id)
        .maybeSingle();
      if (cancelled) return;
      setPath((profile?.avatar_url as string | null) ?? null);
    }

    loadOnce();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      loadOnce();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return path;
}

function HeaderProfileButton() {
  const router = useRouter();
  const avatarPath = useCurrentAvatarPath();
  return (
    <Pressable
      onPress={() => router.push('/profile')}
      hitSlop={10}
      style={{ paddingHorizontal: 14 }}
    >
      {avatarPath ? (
        <Image
          source={{
            uri: avatarPublicUrl(avatarPath),
            cacheKey: avatarPath,
          }}
          style={styles.headerAvatar}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <Ionicons name="person-circle-outline" size={28} color="#111" />
      )}
    </Pressable>
  );
}

// Tabs don't auto-render a back button. Profile is reachable via push from
// every other tab header, so we wire one in manually with a safe fallback
// for the no-history case (deep links, cold open).
function HeaderBackButton() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() =>
        router.canGoBack() ? router.back() : router.replace('/(tabs)')
      }
      hitSlop={10}
      style={{ paddingHorizontal: 14 }}
    >
      <Ionicons name="chevron-back" size={26} color="#111" />
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarActiveTintColor: '#F4FF61',
        tabBarInactiveTintColor: '#0F1117',
        tabBarActiveBackgroundColor: '#0F1117',
        tabBarInactiveBackgroundColor: '#EEF4FB',
        headerStyle: styles.header,
        headerTitleStyle: styles.headerTitle,
        // Profile is reachable from every tab via the header.
        headerRight: () => <HeaderProfileButton />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Closet',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="shirt-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          headerShown: false,
          title: 'Discover',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="compass-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: '',
          tabBarButton: (props) => <CenterAddButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="donations"
        options={{
          title: 'Donate',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="gift-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="box"
        options={{
          title: 'Loved',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="heart-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          // Keep the route reachable via router.push('/profile') but hide it
          // from the bottom bar; the entry point lives in the closet header.
          href: null,
          title: 'Profile',
          headerLeft: () => <HeaderBackButton />,
          // Don't render the redundant profile shortcut when you're already
          // on the profile screen.
          headerRight: () => null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerAvatar: {
    width: 30,
    height: 30,
    borderRadius: 0,
    backgroundColor: '#C8DBF0',
    borderWidth: 2,
    borderColor: '#0F1117',
  },
  header: {
    backgroundColor: '#EEF4FB',
    borderBottomWidth: 3,
    borderBottomColor: '#0F1117',
    elevation: 0,
    shadowOpacity: 0,
  },
  headerTitle: {
    fontFamily: 'WorkSans',
    fontWeight: '900',
    fontSize: 16,
    color: '#0F1117',
    letterSpacing: -0.2,
    textTransform: 'uppercase',
  },
  tabBar: {
    height: 68,
    paddingTop: 0,
    paddingBottom: 0,
    borderTopWidth: 3,
    borderTopColor: '#0F1117',
    backgroundColor: '#EEF4FB',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  centerButton: {
    top: -16,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  centerCircle: {
    width: 58,
    height: 58,
    borderRadius: 0,
    backgroundColor: '#F4FF61',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#0F1117',
    shadowColor: '#0F1117',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
});
