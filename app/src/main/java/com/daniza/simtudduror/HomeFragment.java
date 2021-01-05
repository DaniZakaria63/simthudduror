package com.daniza.simtudduror;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import com.daniza.simtudduror.databinding.FragmentHomeBinding;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

public class HomeFragment extends BaseFragment<FragmentHomeBinding> {
    @Override
    protected FragmentHomeBinding setBinding(LayoutInflater inflater, ViewGroup container, Boolean attachToParent) {
        return FragmentHomeBinding.inflate(inflater,container,attachToParent);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        //TODO: SHOW LIST
    }
}
