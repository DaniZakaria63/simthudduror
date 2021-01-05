package com.daniza.simtudduror;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Toast;

import com.daniza.simtudduror.databinding.FragmentReadBinding;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

public class ReadFragment extends BaseFragment<FragmentReadBinding>{
    private int mImages;
    //TODO: Show Image Zoomable and Scrollable
    @Override
    protected FragmentReadBinding setBinding(LayoutInflater inflater, ViewGroup container, Boolean attachToParent) {
        return FragmentReadBinding.inflate(inflater,container,attachToParent);
    }

    @Override
    public void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        mImages=getArguments().getInt("IMAGE",-1);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        if(mImages == -1){
            Toast.makeText(getMainActivity(), "Terjadi Error", Toast.LENGTH_SHORT).show();
            return;
        }

        binding.ivReadMain.setImageResource(mImages);
    }
}
