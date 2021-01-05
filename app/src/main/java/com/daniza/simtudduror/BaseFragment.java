package com.daniza.simtudduror;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.viewbinding.ViewBinding;

public abstract class BaseFragment<VB extends ViewBinding> extends Fragment {
    protected VB binding;
    protected abstract VB setBinding(LayoutInflater inflater, ViewGroup container, Boolean attachToParent);

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        setHasOptionsMenu(true);
        binding=setBinding(inflater, container, false);
        return binding.getRoot();
    }

    protected MainActivity getMainActivity(){
        return (MainActivity)requireActivity();
    }
}
