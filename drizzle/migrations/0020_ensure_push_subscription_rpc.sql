CREATE OR REPLACE FUNCTION public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_endpoint IS NULL OR length(p_endpoint) > 4096 OR p_endpoint !~ '^https://(fcm[.]googleapis[.]com|android[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|[a-z0-9-]+[.]notify[.]windows[.]com|web[.]push[.]apple[.]com)/[^[:space:]]+$' THEN
    RAISE EXCEPTION 'Destino de notificacao invalido';
  END IF;
  IF p_p256dh IS NULL OR p_p256dh !~ '^[A-Za-z0-9_-]{87}=?$' OR p_auth IS NULL OR p_auth !~ '^[A-Za-z0-9_-]{22}(==)?$' THEN
    RAISE EXCEPTION 'Assinatura de notificacao invalida';
  END IF;
  INSERT INTO public.push_subscriptions (endpoint, p256dh, auth, user_agent)
  VALUES (p_endpoint, p_p256dh, p_auth, left(p_user_agent, 500))
  ON CONFLICT (endpoint) DO UPDATE
  SET p256dh = EXCLUDED.p256dh,
      auth = EXCLUDED.auth,
      user_agent = COALESCE(EXCLUDED.user_agent, public.push_subscriptions.user_agent);
END;
$$;
REVOKE ALL ON FUNCTION public.save_push_subscription(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_push_subscription(text, text, text, text) TO anon, authenticated, service_role;
GRANT SELECT ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;